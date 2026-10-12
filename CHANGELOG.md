# Changelog

## [1.0.2](https://github.com/duyet/anyrouter/compare/ai-sdk-provider-v1.0.1...ai-sdk-provider-v1.0.2) (2026-10-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^1.0.2 to ^1.0.3

## [1.0.1](https://github.com/duyet/anyrouter/compare/ai-sdk-provider-v1.0.0...ai-sdk-provider-v1.0.1) (2026-09-28)


### 🐛 Bug Fixes

* **release:** repair version drift from stale release-please branch merges ([#3555](https://github.com/duyet/anyrouter/issues/3555)) ([ff0a89f](https://github.com/duyet/anyrouter/commit/ff0a89f1051e6a22bae1ae76ed4bed85e3330102))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^1.0.1 to ^1.0.2

## 1.0.0 (2026-09-24)


### 🐛 Bug Fixes

* **sdk:** align ai-sdk-provider range with workspace @anyr/sdk 1.0.0 ([#2846](https://github.com/duyet/anyrouter/issues/2846)) ([7cd866e](https://github.com/duyet/anyrouter/commit/7cd866efc67c14c28e90fc43d1c1a7171f542000))
* **sdk:** restore ai-sdk-provider @anyr/sdk pin to workspace 1.0.0 ([#3041](https://github.com/duyet/anyrouter/issues/3041)) ([1e14da4](https://github.com/duyet/anyrouter/commit/1e14da46cfc9e582ddbd302e9fac70ba1b1ff4ef))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^1.0.1 to ^1.0.0

## [0.1.10](https://github.com/duyet/anyrouter/compare/ai-sdk-provider-v1.0.0...ai-sdk-provider-v0.1.10) (2026-09-24)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^1.0.1 to ^1.0.0

## [0.1.9](https://github.com/duyet/anyrouter/compare/ai-sdk-provider-v0.1.8...ai-sdk-provider-v0.1.9) (2026-09-24)


### 🐛 Bug Fixes

* **sdk:** restore ai-sdk-provider @anyr/sdk pin to workspace 1.0.0 ([#3041](https://github.com/duyet/anyrouter/issues/3041)) ([1e14da4](https://github.com/duyet/anyrouter/commit/1e14da46cfc9e582ddbd302e9fac70ba1b1ff4ef))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^1.0.0 to ^1.0.1

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
