import type { EmbeddingModelV4, FilesV4, LanguageModelV4, ProviderV4 } from "@ai-sdk/provider"
import { NoSuchModelError } from "@ai-sdk/provider"
import { combineHeaders, loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils"
import { AnyRouter, buildAppAttributionHeaders, DEFAULT_BASE_URL } from "@anyr/sdk"
import { AnyRouterChatLanguageModel } from "./anyrouter-chat-language-model"
import { AnyRouterEmbeddingModel } from "./anyrouter-embedding-model"
import { AnyRouterFiles } from "./anyrouter-files"
import { FileReferenceCache } from "./file-reference-cache"
import type { AnyRouterProviderSettings } from "./types"

const PROVIDER_ID = "anyrouter"

export interface AnyRouterProvider extends ProviderV4 {
  /** Create a chat language model by calling the provider directly. */
  (modelId: string): LanguageModelV4

  /** Create a chat language model (explicit method). */
  chat(modelId: string): LanguageModelV4

  /**
   * Low-level `@anyr/sdk` client instance.
   * Use this as an escape hatch when you need direct API access.
   */
  readonly client: AnyRouter

  /**
   * File management interface (AI SDK v4 `FilesV4`).
   *
   * Call `uploadFile()` to register a file in the session cache.  The returned
   * `providerReference` can be used in subsequent model calls as a
   * `{ type: 'file', data: { type: 'reference', reference } }` part — the
   * provider resolves the reference from the cache without re-encoding the file.
   *
   * ```ts
   * const ref = await anyrouter.files().uploadFile({
   *   data: { type: 'data', data: pdfBytes },
   *   mediaType: 'application/pdf',
   * })
   * // ref.providerReference === { anyrouter: '<sha256-hex>' }
   * ```
   */
  files(): FilesV4
}

/**
 * Create an AnyRouter provider for the Vercel AI SDK.
 *
 * ```ts
 * import { createAnyRouter } from "@anyr/ai-sdk-provider"
 * import { generateText } from "ai"
 *
 * const anyrouter = createAnyRouter() // reads ANYROUTER_API_KEY
 * const { text } = await generateText({
 *   model: anyrouter("openai/gpt-4o-mini"),
 *   prompt: "Hello!",
 * })
 * ```
 *
 * The `apiKey` is resolved **lazily** at request time (not at
 * `createAnyRouter()` call time), so the factory can be constructed
 * before environment variables are populated.
 */
export function createAnyRouter(options: AnyRouterProviderSettings = {}): AnyRouterProvider {
  const baseURL = withoutTrailingSlash(options.baseURL ?? DEFAULT_BASE_URL) ?? DEFAULT_BASE_URL

  /**
   * Shared file reference cache for this provider instance.
   * All chat models and the FilesV4 interface share this cache so that a file
   * uploaded via `provider.files().uploadFile()` can be referenced in any
   * subsequent model call within the same session.
   */
  const sharedFileCache = new FileReferenceCache()

  /** Resolve the API key and build request headers lazily at request time. */
  function getHeaders(): Record<string, string | undefined> {
    // Keyless mode: no key resolution. Auth comes from ambient sources (same-origin
    // session cookies, or an Authorization passed via `headers`). Avoids the
    // `loadApiKey` throw on the Playground's keyless default flow.
    // Attribution sits below `options.headers` so an explicit header wins.
    const attribution = options.app ? buildAppAttributionHeaders(options.app) : {}
    if (options.keyless) {
      return combineHeaders(attribution, options.headers)
    }
    const apiKey = loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: "ANYROUTER_API_KEY",
      description: "AnyRouter",
    })
    return combineHeaders({ Authorization: `Bearer ${apiKey}`, ...attribution }, options.headers)
  }

  function chatModel(modelId: string): AnyRouterChatLanguageModel {
    return new AnyRouterChatLanguageModel(modelId, {
      provider: PROVIDER_ID,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
      settings: options,
      fileCache: sharedFileCache,
    })
  }

  function embeddingModel(modelId: string): AnyRouterEmbeddingModel {
    return new AnyRouterEmbeddingModel(modelId, {
      provider: PROVIDER_ID,
      baseURL,
      headers: getHeaders,
      fetch: options.fetch,
    })
  }

  /**
   * The callable provider — calling it directly returns a chat model.
   */
  const provider = (modelId: string): LanguageModelV4 => chatModel(modelId)

  const providerObj = Object.assign(provider, {
    // ProviderV4 required fields
    specificationVersion: "v4" as const,

    // ProviderV4 required methods
    languageModel(modelId: string): LanguageModelV4 {
      return chatModel(modelId)
    },
    embeddingModel(modelId: string): EmbeddingModelV4 {
      return embeddingModel(modelId)
    },

    // AnyRouter convenience alias
    chat(modelId: string): LanguageModelV4 {
      return chatModel(modelId)
    },

    // ProviderV4 file-management interface
    files(): FilesV4 {
      return new AnyRouterFiles(PROVIDER_ID, sharedFileCache)
    },

    // Unsupported optional model types — throw NoSuchModelError per ProviderV4 contract.
    // Image/video generation is not an AnyRouter product (text + embeddings only).
    imageModel(modelId: string): never {
      throw new NoSuchModelError({ modelId, modelType: "imageModel" })
    },
    transcriptionModel(modelId: string): never {
      throw new NoSuchModelError({ modelId, modelType: "transcriptionModel" })
    },
    speechModel(modelId: string): never {
      throw new NoSuchModelError({ modelId, modelType: "speechModel" })
    },
  })

  // Define `client` as a proper getter so that Object.assign does not invoke it
  // eagerly (Object.assign reads property values, which would call the getter
  // and trigger AnyRouter key resolution before any API call).
  Object.defineProperty(providerObj, "client", {
    enumerable: true,
    configurable: true,
    get(): AnyRouter {
      return new AnyRouter({
        apiKey: options.apiKey,
        baseURL: options.baseURL,
        headers: options.headers,
        app: options.app,
        fetch: options.fetch,
      })
    },
  })

  return providerObj as unknown as AnyRouterProvider
}

/**
 * Default AnyRouter provider instance.
 *
 * Uses `ANYROUTER_API_KEY` from the environment (resolved lazily at request time).
 *
 * ```ts
 * import { anyrouter } from "@anyr/ai-sdk-provider"
 * import { generateText } from "ai"
 *
 * const { text } = await generateText({
 *   model: anyrouter("openai/gpt-4o-mini"),
 *   prompt: "Hello!",
 * })
 * ```
 */
export const anyrouter = createAnyRouter()
