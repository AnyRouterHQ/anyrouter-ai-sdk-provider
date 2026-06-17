import { describe, expect, it } from "vitest"
import { createAnyRouter } from "./anyrouter-provider"

function mockEmbeddingFetch(
  embeddings: number[][],
  usage?: { prompt_tokens: number },
): typeof globalThis.fetch {
  return async () =>
    new Response(
      JSON.stringify({
        data: embeddings.map((embedding) => ({ embedding })),
        usage,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
}

describe("AnyRouterEmbeddingModel.doEmbed()", () => {
  it("sends correct request body and returns embeddings", async () => {
    let capturedBody: unknown

    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string)
        return new Response(
          JSON.stringify({
            data: [{ embedding: [0.1, 0.2, 0.3] }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      },
    })

    const model = ar.embeddingModel("openai/text-embedding-3-small")
    const result = await model.doEmbed({ values: ["hello world"] })

    expect((capturedBody as Record<string, unknown>).model).toBe("openai/text-embedding-3-small")
    expect((capturedBody as Record<string, unknown>).input).toEqual(["hello world"])

    expect(result.embeddings).toHaveLength(1)
    expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
  })

  it("returns multiple embeddings in order", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockEmbeddingFetch([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]),
    })

    const result = await ar
      .embeddingModel("openai/text-embedding-3-large")
      .doEmbed({ values: ["a", "b", "c"] })

    expect(result.embeddings).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ])
  })

  it("maps usage.tokens from prompt_tokens", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockEmbeddingFetch([[0.5, 0.5]], { prompt_tokens: 7 }),
    })

    const result = await ar
      .embeddingModel("openai/text-embedding-3-small")
      .doEmbed({ values: ["test"] })

    expect(result.usage?.tokens).toBe(7)
  })

  it("returns no usage when not provided", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockEmbeddingFetch([[0.5]]),
    })

    const result = await ar
      .embeddingModel("openai/text-embedding-3-small")
      .doEmbed({ values: ["test"] })

    expect(result.usage).toBeUndefined()
  })

  it("has supportsParallelCalls=true and maxEmbeddingsPerCall=undefined", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.embeddingModel("openai/text-embedding-3-small")
    expect(model.supportsParallelCalls).toBe(true)
    expect(model.maxEmbeddingsPerCall).toBeUndefined()
  })
})
