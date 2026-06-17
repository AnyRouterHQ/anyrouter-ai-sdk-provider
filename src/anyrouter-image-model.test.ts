import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { createAnyRouter } from "./anyrouter-provider"

function mockImageFetch(data: Array<{ b64_json?: string; url?: string }>): typeof globalThis.fetch {
  return async () =>
    new Response(JSON.stringify({ created: 1700000000, data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
}

describe("AnyRouterImageModel.doGenerate()", () => {
  it("sends correct request body and returns b64_json images", async () => {
    let capturedBody: unknown

    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string)
        return new Response(
          JSON.stringify({
            data: [{ b64_json: "base64data==" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      },
    })

    const model = ar.imageModel("openai/dall-e-3")
    const result = await model.doGenerate({
      prompt: "a cat",
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    })

    expect((capturedBody as Record<string, unknown>).model).toBe("openai/dall-e-3")
    expect((capturedBody as Record<string, unknown>).prompt).toBe("a cat")
    expect((capturedBody as Record<string, unknown>).n).toBe(1)

    expect(result.images).toEqual(["base64data=="])
    expect(result.warnings).toEqual([])
    expect(result.response.modelId).toBe("openai/dall-e-3")
    expect(result.response.timestamp).toBeInstanceOf(Date)
  })

  it("falls back to url when b64_json is absent", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockImageFetch([{ url: "https://example.com/image.png" }]),
    })

    const result = await ar.imageModel("openai/dall-e-3").doGenerate({
      prompt: "a dog",
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    })

    expect(result.images).toEqual(["https://example.com/image.png"])
  })

  it("emits unsupported warning when n > 1", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockImageFetch([{ b64_json: "data" }]),
    })

    const result = await ar.imageModel("openai/dall-e-3").doGenerate({
      prompt: "flowers",
      n: 4,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    })

    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].type).toBe("unsupported")
  })

  it("throws UnsupportedFunctionalityError when mask is provided", async () => {
    const ar = createAnyRouter({ apiKey: "test-test" })

    await expect(
      ar.imageModel("openai/dall-e-3").doGenerate({
        prompt: "cat",
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: { type: "file", mediaType: "image/png", data: "maskdata" },
        providerOptions: {},
      }),
    ).rejects.toBeInstanceOf(UnsupportedFunctionalityError)
  })

  it("has maxImagesPerCall=1", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.imageModel("openai/dall-e-3")
    expect(model.maxImagesPerCall).toBe(1)
  })
})
