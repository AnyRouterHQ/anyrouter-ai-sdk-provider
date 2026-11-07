# Changelog

## [0.1.8](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/compare/v0.1.7...v0.1.8) (2026-11-07)


### ✨ Features

* add @anyr/sdk and @anyr/ai-sdk-provider packages ([#556](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/556)) ([360d914](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/360d914741ed7644615e30c0f62927b51e04ed57))
* **ai-sdk-provider:** cache passthrough options ([6b84276](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/6b842763cee9808c5ca8587e14f76fe127d93053))
* **ai-sdk-provider:** keyless mode for createAnyRouter ([#852](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/852)) ([6de8f11](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/6de8f1167b17d10850cf109951a0eed62767bf5f))
* **ai-sdk:** file & skill uploads with provider file references ([#781](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/781) Phase 2) ([#827](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/827)) ([82cd00d](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/82cd00d75c596ded6e046fa134f2a8e7a4e5f38f))
* **ai-sdk:** upgrade to AI SDK 7 + reasoning control ([#819](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/819)) ([48d3860](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/48d3860ee51713c196be27172a8b1b1e0ce78260))
* publish 0.1.7 from standalone repo, vendored attribution ([00273c9](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/00273c9b0817e7a9ee3ba9a06d0b53467ccefdf7))
* **telemetry:** email engagement tracking and client-type attribution ([58914a4](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/58914a4863f78ad3bdec64359219b9cac9bd7b97))


### 🐛 Bug Fixes

* **ai-sdk-provider:** accept null usage and tool_calls in chat chunks ([#5778](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/5778)) ([73d78d2](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/73d78d2e169752d104105eeb8ce8c6211e6b332f))
* **ai-sdk-provider:** surface reasoning_content as AI SDK reasoning parts ([ee1ce56](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/ee1ce567287f186b0ea8915055ed7167d27facf3))
* **ai-sdk:** playground/dashboard SSR stubs parse ai barrel; fix streaming usage ([b0ac955](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/b0ac9551eec847b2a723539030032b1116fbf1e9))
* **deps:** pin ai-sdk-provider to the released @anyr/sdk 0.1.3 and refresh the lockfile ([dd13738](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/dd13738b2804fe7bc68eae78d012771def3896da))
* **explain:** keep the catalog out of the client bundle, fix dev hydration, drop cacheKey ([#6022](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/6022)) ([a36d85d](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/a36d85d93fe3e753efe871d5b86f9994f8aa5db0))
* **release:** repair version drift from stale release-please branch merges ([#3555](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/3555)) ([f0ccfa0](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/f0ccfa08ccc2c3daa55d8c0cc4d493e1c261ce29))
* **sdk:** align ai-sdk-provider range with workspace @anyr/sdk 1.0.0 ([#2846](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/2846)) ([f38c13a](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/f38c13ade7555b6eea9631542b7ce9982a92797a))
* **sdk:** restore ai-sdk-provider @anyr/sdk pin to workspace 1.0.0 ([#3041](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/3041)) ([6231670](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/623167057a17e2f67ad1f0753e4754835b6bd4bf))
* **web:** hydration [#418](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/418) parity, try-chat no-output handling, ignore clerk_offline ([#6586](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/issues/6586)) ([6028e9d](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/6028e9d52a8c397b69427c31bebf3dcea936df52))


### ♻️ Refactoring

* **ai-sdk-provider:** drop section banner comments ([512d520](https://github.com/AnyRouterHQ/anyrouter-ai-sdk-provider/commit/512d5204b0a79443f740b97a95b6ed687e33aafd))

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
