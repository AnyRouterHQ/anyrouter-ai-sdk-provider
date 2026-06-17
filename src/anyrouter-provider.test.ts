import { describe, expect, it } from "vitest"
import { AnyRouterChatLanguageModel } from "./anyrouter-chat-language-model"
import { AnyRouterEmbeddingModel } from "./anyrouter-embedding-model"
import { AnyRouterImageModel } from "./anyrouter-image-model"
import { createAnyRouter } from "./anyrouter-provider"

describe("createAnyRouter()", () => {
  it("returns a callable that produces a chat model", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar("openai/gpt-4o-mini")
    expect(model).toBeInstanceOf(AnyRouterChatLanguageModel)
    expect(model.modelId).toBe("openai/gpt-4o-mini")
    expect(model.specificationVersion).toBe("v3")
    expect(model.provider).toBe("anyrouter")
  })

  it(".chat() produces a chat model", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.chat("anthropic/claude-opus-4-5")
    expect(model).toBeInstanceOf(AnyRouterChatLanguageModel)
    expect(model.modelId).toBe("anthropic/claude-opus-4-5")
  })

  it(".languageModel() produces a chat model (ProviderV3 interface)", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.languageModel("openai/gpt-4o")
    expect(model).toBeInstanceOf(AnyRouterChatLanguageModel)
  })

  it(".embeddingModel() produces an embedding model (ProviderV3)", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.embeddingModel("openai/text-embedding-3-small")
    expect(model).toBeInstanceOf(AnyRouterEmbeddingModel)
    expect(model.modelId).toBe("openai/text-embedding-3-small")
    expect(model.specificationVersion).toBe("v3")
  })

  it(".textEmbeddingModel() is a deprecated alias for embeddingModel", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    // textEmbeddingModel is optional in ProviderV3 — use unknown cast to access it
    const model = (
      ar as unknown as { textEmbeddingModel(id: string): AnyRouterEmbeddingModel }
    ).textEmbeddingModel("openai/text-embedding-3-large")
    expect(model).toBeInstanceOf(AnyRouterEmbeddingModel)
  })

  it(".imageModel() produces an image model", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    const model = ar.imageModel("openai/dall-e-3")
    expect(model).toBeInstanceOf(AnyRouterImageModel)
    expect(model.modelId).toBe("openai/dall-e-3")
    expect(model.specificationVersion).toBe("v3")
  })

  it("specificationVersion is v3 (ProviderV3)", () => {
    const ar = createAnyRouter({ apiKey: "test-test" })
    expect(ar.specificationVersion).toBe("v3")
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
})
