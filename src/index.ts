/**
 * `@anyr/ai-sdk-provider` — the AnyRouter provider for the Vercel AI SDK.
 *
 * ```ts
 * import { createAnyRouter, anyrouter } from "@anyr/ai-sdk-provider"
 * import { generateText } from "ai"
 *
 * // Option 1: use the default instance (reads ANYROUTER_API_KEY)
 * const { text } = await generateText({
 *   model: anyrouter("openai/gpt-4o-mini"),
 *   prompt: "Hello!",
 * })
 *
 * // Option 2: explicit configuration
 * const myProvider = createAnyRouter({ apiKey: "<your-anyrouter-key>" })
 * const { text: text2 } = await generateText({
 *   model: myProvider.chat("anthropic/claude-opus-4-5"),
 *   prompt: "Hello!",
 * })
 * ```
 *
 * @packageDocumentation
 */

export type { AnyRouterChatConfig } from "./anyrouter-chat-language-model"
export { AnyRouterChatLanguageModel } from "./anyrouter-chat-language-model"
export type { AnyRouterEmbeddingConfig } from "./anyrouter-embedding-model"
export { AnyRouterEmbeddingModel } from "./anyrouter-embedding-model"
export type { AnyRouterImageConfig } from "./anyrouter-image-model"
export { AnyRouterImageModel } from "./anyrouter-image-model"
export type { AnyRouterProvider } from "./anyrouter-provider"
export { anyrouter, createAnyRouter } from "./anyrouter-provider"
export type { AnyRouterProviderSettings } from "./types"
