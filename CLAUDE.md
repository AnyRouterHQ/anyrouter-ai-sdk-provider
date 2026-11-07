# @anyr/ai-sdk-provider — agent notes

Published Vercel AI SDK provider for AnyRouter. It exposes `createAnyRouter` and wraps `@anyr/sdk`.

Standalone repo. Moved from `packages/ai-sdk-provider` in the `anyrouter` monorepo on 2026-11-07 with its 38-commit related history. The npm name stays `@anyr/ai-sdk-provider`; 0.1.7 is the first release from this repo.

## Entry points

- `src/index.ts`: public barrel. `package.json` `exports` points at `dist/` (tsup output).
- `src/anyrouter-provider.ts`: the `createAnyRouter` provider factory.
- `src/app-attribution.ts`: vendored `AppAttribution` + `buildAppAttributionHeaders` (the published `@anyr/sdk@0.1.3` does not export them).

## Where things live

| Path | Responsibility |
|------|----------------|
| `src/anyrouter-provider.ts` | Provider factory and model constructors |
| `src/anyrouter-chat-language-model.ts` | Chat language model |
| `src/anyrouter-embedding-model.ts` | Embedding model |
| `src/anyrouter-files.ts` | File input handling |
| `src/file-reference-cache.ts` | Cache for file references |
| `src/convert-to-anyrouter-chat-messages.ts` | AI SDK prompt to AnyRouter chat message conversion |
| `src/app-attribution.ts` | App attribution headers (vendored, see above) |
| `src/types.ts` | Shared option types (`AnyRouterProviderSettings`) |
| `src/*.test.ts` | Colocated vitest specs |

## Key commands

From `package.json` scripts:

- `pnpm build`: `tsup`, writes `dist/`.
- `pnpm dev`: `tsup --watch`.
- `pnpm typecheck`: `tsgo --noEmit`.
- `pnpm test`: `vitest run`.
- `pnpm clean`: removes `dist`.

## Dependency contract

- Peer dependencies are `ai` ^7 and `@ai-sdk/provider` ^4 plus `@ai-sdk/provider-utils` ^5 and `zod`.
- The package depends on `@anyr/sdk` `^0.1.3` (published). Only `AnyRouter` and `DEFAULT_BASE_URL` are used from the SDK; attribution is vendored so the package loads against the published SDK.
- Do not reintroduce imports of `buildAppAttributionHeaders` or `AppAttribution` from `@anyr/sdk` until the published SDK exports them.

## Publishing

Release 0.1.7 shipped from this repo. Future versions: bump `package.json`, update `CHANGELOG.md`, push a tag `v<version>`. The `publish` workflow builds, tests, and runs `npm publish --access public` with the `NPM_TOKEN` secret (`--provenance` when available).
