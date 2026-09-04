# Changelog

## [0.1.8](https://github.com/duyet/anyrouter/compare/ai-sdk-provider-v0.1.7...ai-sdk-provider-v0.1.8) (2026-09-04)


### 🐛 Bug Fixes

* **sdk:** align ai-sdk-provider range with workspace @anyr/sdk 1.0.0 ([#2846](https://github.com/duyet/anyrouter/issues/2846)) ([7cd866e](https://github.com/duyet/anyrouter/commit/7cd866efc67c14c28e90fc43d1c1a7171f542000))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^1.0.0 to ^0.1.6

## [0.1.7](https://github.com/duyet/anyrouter/compare/ai-sdk-provider-v0.1.5...ai-sdk-provider-v0.1.7) (2026-08-20)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^0.1.3 to ^0.1.5

## [0.1.5](https://github.com/duyet/anyrouter/compare/ai-sdk-provider-v0.1.4...ai-sdk-provider-v0.1.5) (2026-07-31)


### ✨ Features

* **ai-sdk-provider:** cache passthrough options ([4090989](https://github.com/duyet/anyrouter/commit/409098972bf55d5ba3dd6e4eeca4ec77493683b3))
* **telemetry:** email engagement tracking and client-type attribution ([ebbdc9d](https://github.com/duyet/anyrouter/commit/ebbdc9dfceb7e263ec39cdab7bea8e9a036f821d))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^0.1.1 to ^0.1.4

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
