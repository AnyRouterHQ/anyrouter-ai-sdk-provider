# Changelog

## [0.1.7](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/compare/v0.1.6...v0.1.7) (2026-11-07)

First release from the standalone repo `AnyRouterHQ/anyrouter-ai-sdk-provider`. The code moved from the `packages/ai-sdk-provider` folder in the `anyrouter` monorepo with its full related history (38 commits). This release supersedes the unpublished monorepo 0.1.7–1.0.3 line. It works with the published `@anyr/sdk@0.1.3`: the app-attribution helper (`buildAppAttributionHeaders`) is vendored in this package because the published SDK does not export it (the previous `0.1.6` tarball import would fail at load).

### ⚠ BREAKING CHANGES

* removed the `cacheKey` provider setting and `providerOptions.anyrouter.cacheKey`. The API no longer forwards a client `cf-aig-cache-key` (a custom key was shared across all callers of the gateway), so it did nothing. `cacheTtl` and `skipCache` are unchanged.

### Bug Fixes

* a mid-stream `data: {"error":{...}}` frame now ends the stream with an `error` part (an `APICallError` that keeps the gateway `code` and `message` in `responseBody`) and finish reason `error`. Before, the frame was dropped and the turn ended as an empty answer.
* fixed unconditional import of `buildAppAttributionHeaders` from `@anyr/sdk` (missing in `0.1.3`) by vendoring the helper locally; `createAnyRouter()` now loads with the published SDK.

## [1.0.3](https://github.com/duyet/anyrouter/compare/ai-sdk-provider-v1.0.2...ai-sdk-provider-v1.0.3) (2026-11-04)


### ♻️ Refactoring

* **ai-sdk-provider:** drop section banner comments ([82941d1](https://github.com/duyet/anyrouter/commit/82941d18072bb200590433ab3b93e90c291bd3f3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @anyr/sdk bumped from ^1.0.3 to ^1.0.4

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
