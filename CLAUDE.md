# @anyr/ai-sdk-provider — agent notes

Published Vercel AI SDK provider for AnyRouter. It exposes `createAnyRouter` and wraps `@anyr/sdk`.

## Entry points

- `src/index.ts`: public barrel. `package.json` `exports` points at `dist/` (tsup output).
- `src/anyrouter-provider.ts`: the `createAnyRouter` provider factory.

## Where things live

| Path | Responsibility |
|------|----------------|
| `src/anyrouter-provider.ts` | Provider factory and model constructors |
| `src/anyrouter-chat-language-model.ts` | Chat language model |
| `src/anyrouter-embedding-model.ts` | Embedding model |
| `src/anyrouter-files.ts` | File input handling |
| `src/file-reference-cache.ts` | Cache for file references |
| `src/convert-to-anyrouter-chat-messages.ts` | AI SDK prompt to AnyRouter chat message conversion |
| `src/types.ts` | Shared option types |
| `src/*.test.ts` | Colocated vitest specs |

## Key commands

From `package.json` scripts:

- `pnpm --filter @anyr/ai-sdk-provider build`: `tsup`, writes `dist/`.
- `pnpm --filter @anyr/ai-sdk-provider dev`: `tsup --watch`.
- `pnpm --filter @anyr/ai-sdk-provider typecheck`: `tsc --noEmit`.
- `pnpm --filter @anyr/ai-sdk-provider test`: `vitest run`.
- `pnpm --filter @anyr/ai-sdk-provider clean`: removes `dist`.

Peer dependencies are `ai` ^7 and `@ai-sdk/provider` ^4. The package depends on `@anyr/sdk`.

## Related docs

- `docs/kb/development/anyr-sdk-packages.md`: how the published packages are built and shipped.
- `docs/kb/development/playground-build-needs-sdk-dist.md`: consumers need both SDK dists before bundling.
- `docs/kb/development/coverage-run-needs-sdk-package-builds.md`: coverage runs resolve against `dist/`.
- `docs/kb/development/changelog-docs-generated-from-package-changelogs.md`: `CHANGELOG.md` feeds the docs pages.
- `docs/kb/development/cli-otui-helpers-lazy-provider.md`: keep the provider import dynamic in CLI helpers.
