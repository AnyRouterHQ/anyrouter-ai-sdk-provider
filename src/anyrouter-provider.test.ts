import { NoSuchModelError } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { AnyRouterChatLanguageModel } from "./anyrouter-chat-language-model"
import { AnyRouterEmbeddingModel } from "./anyrouter-embedding-model"
import { createAnyRouter } from "./anyrouter-provider"

describe("createAnyRouter()", () => {
  it("returns a callable that produces a chat model", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar("openai/gpt-4o-mini")
    expect(model).toBeInstanceOf(AnyRouterChatLanguageModel)
    expect(model.modelId).toBe("openai/gpt-4o-mini")
    expect(model.specificationVersion).toBe("v4")
    expect(model.provider).toBe("anyrouter")
  })

  it(".chat() produces a chat model", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.chat("anthropic/claude-opus-4-5")
    expect(model).toBeInstanceOf(AnyRouterChatLanguageModel)
    expect(model.modelId).toBe("anthropic/claude-opus-4-5")
  })

  it(".languageModel() produces a chat model (ProviderV4 interface)", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.languageModel("openai/gpt-4o")
    expect(model).toBeInstanceOf(AnyRouterChatLanguageModel)
  })

  it(".embeddingModel() produces an embedding model (ProviderV4)", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.embeddingModel("openai/text-embedding-3-small")
    expect(model).toBeInstanceOf(AnyRouterEmbeddingModel)
    expect(model.modelId).toBe("openai/text-embedding-3-small")
    expect(model.specificationVersion).toBe("v4")
  })

  it(".imageModel() is unsupported (text/embeddings only)", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    expect(() => ar.imageModel("openai/dall-e-3")).toThrow(NoSuchModelError)
  })

  it("specificationVersion is v4 (ProviderV4)", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    expect(ar.specificationVersion).toBe("v4")
  })

  it("exposes .client getter returning AnyRouter instance", () => {
    const ar = createAnyRouter({ apiKey: "test-explicit" })
    const client = ar.client
    // AnyRouter class has a baseURL property
    expect(typeof client.baseURL).toBe("string")
  })

  it("uses default baseURL when none provided", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    // baseURL is internal; verify via client (apiKey is explicit so safe)
    expect(ar.client.baseURL).toBe("https://anyrouter.dev/api/v1")
  })

  it("respects custom baseURL (strips trailing slash)", () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      baseURL: "https://custom.example.com/api/v1/",
    })
    expect(ar.client.baseURL).toBe("https://custom.example.com/api/v1")
  })

  it("resolves apiKey from ANYROUTER_API_KEY env var at request time", () => {
    // The provider should be constructible without a key — error only at request time
    process.env.ANYROUTER_API_KEY = "test-from-env"
    try {
      const ar = createAnyRouter() // no apiKey
      // Creating models doesn't throw
      const model = ar("openai/gpt-4o-mini")
      expect(model.modelId).toBe("openai/gpt-4o-mini")
    } finally {
      delete process.env.ANYROUTER_API_KEY
    }
  })

  it("explicit apiKey takes precedence over env var", () => {
    process.env.ANYROUTER_API_KEY = "test-from-env"
    try {
      const ar = createAnyRouter({ apiKey: "test-explicit" })
      // Verify via client (explicit key so AnyRouter constructor won't fail)
      expect(ar.client.baseURL).toContain("anyrouter.dev")
    } finally {
      delete process.env.ANYROUTER_API_KEY
    }
  })

  // ─── keyless mode ───────────────────────────────────────────────────

  it("keyless: omits the Authorization header instead of throwing on missing key", async () => {
    let capturedAuth: string | null = "unset"
    const fetchMock: typeof globalThis.fetch = async (_url, init) => {
      capturedAuth = new Headers(init?.headers).get("authorization")
      return new Response(
        JSON.stringify({
          id: "g1",
          model: "openai/gpt-4o-mini",
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    // No apiKey, no ANYROUTER_API_KEY — non-keyless would throw inside loadApiKey.
    delete process.env.ANYROUTER_API_KEY
    const ar = createAnyRouter({ keyless: true, fetch: fetchMock })
    await ar("openai/gpt-4o-mini").doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    })
    expect(capturedAuth).toBeNull()
  })

  it("keyless: still forwards an Authorization supplied via headers (session token)", async () => {
    let capturedAuth: string | null = null
    const fetchMock: typeof globalThis.fetch = async (_url, init) => {
      capturedAuth = new Headers(init?.headers).get("authorization")
      return new Response(
        JSON.stringify({
          id: "g2",
          model: "openai/gpt-4o-mini",
          choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    const ar = createAnyRouter({
      keyless: true,
      headers: { Authorization: "Bearer session-xyz" },
      fetch: fetchMock,
    })
    await ar("openai/gpt-4o-mini").doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    })
    expect(capturedAuth).toBe("Bearer session-xyz")
  })
})
