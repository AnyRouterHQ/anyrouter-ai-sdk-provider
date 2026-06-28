/**
 * Settings for `createAnyRouter(...)`.
 */
export interface AnyRouterProviderSettings {
  /**
   * AnyRouter API key (`sk-ar-v1-…`).
   * Falls back to the `ANYROUTER_API_KEY` environment variable when omitted.
   * Resolved lazily at request time.
   */
  apiKey?: string

  /**
   * Skip API-key resolution entirely. When `true`, no `Authorization` header is
   * derived from `apiKey`/`ANYROUTER_API_KEY` — requests rely on ambient auth
   * such as same-origin session cookies (the AnyRouter Playground) or an
   * `Authorization` header supplied via {@link headers}.
   *
   * Without this, `createAnyRouter()` throws at request time when no key is
   * present. Defaults to `false`.
   */
  keyless?: boolean

  /**
   * API base URL.
   * Defaults to `https://anyrouter.dev/api/v1`.
   */
  baseURL?: string

  /**
   * Extra headers merged into every request.
   */
  headers?: Record<string, string>

  /**
   * Custom fetch implementation.
   * Defaults to the global `fetch`.
   */
  fetch?: typeof globalThis.fetch

  /**
   * AnyRouter routing preference forwarded as the `provider` field.
   *
   * @example { only: ["openai"], quantizations: ["bf16"] }
   */
  provider?: Record<string, unknown>

  /**
   * Session identifier forwarded as `session_id` on every request.
   * Useful for grouping related requests in usage analytics.
   */
  sessionId?: string

  /**
   * Extra fields merged into every request body.
   * Per-call `providerOptions.anyrouter.extraBody` takes precedence.
   */
  extraBody?: Record<string, unknown>
}
