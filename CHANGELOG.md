# Changelog

## 0.1.4 (2026-06-18)

### 🐛 Bug Fixes

* surface `reasoning_content` from reasoning models (DeepSeek-R1, GLM thinking, …) as the AI SDK's standard reasoning parts — `reasoning` / `reasoningText` and the full-stream `reasoning-start` / `reasoning-delta` / `reasoning-end` parts now work

## 0.1.3 (2026-06-18)

### ✨ Features

* support the Vercel AI SDK v7 (beta) alongside v6 — widened `ai`, `@ai-sdk/provider`, and `@ai-sdk/provider-utils` peer ranges

## 0.1.2 (2026-06-18)

### ✨ Features

* initial public release of the AnyRouter provider for the Vercel AI SDK
* `createAnyRouter()` / `anyrouter` — chat (`LanguageModelV3`), embeddings, and image models
* tool calling, structured output, streaming, and provider routing / `session_id` / `extraBody` passthrough via provider settings and per-call `providerOptions.anyrouter`
