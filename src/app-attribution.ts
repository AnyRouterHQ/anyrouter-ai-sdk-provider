/**
 * App attribution for the AnyRouter AI SDK provider.
 *
 * Vendored from `@anyr/sdk` `core/app-attribution.ts` so this package works
 * with the published `@anyr/sdk@0.1.3`, which does not yet export the helper.
 * Every AnyRouter request carries an optional `X-AnyRouter-*` triplet that
 * tells the gateway which client made it. Without it, first-party clients
 * land in the anonymous raw-User-Agent bucket.
 *
 * Precedence (lowest to highest): provider default, `options.app`,
 * `options.headers`, per-request headers. An explicit header always wins,
 * so a caller can suppress attribution entirely by passing an empty string.
 */

/** `app_source` reported when the caller supplies no `app` option. */
export const APP_SOURCE = "anyr-ai-sdk-provider"

/** `app_title` reported when the caller supplies no `app` option. */
export const APP_TITLE = "AnyRouter AI SDK Provider"

/**
 * Version stamped on attributed requests. Kept as a literal (not a
 * `package.json` import) because the package is bundled for browsers and
 * Workers where JSON imports are not universally available.
 */
export const APP_VERSION = "0.1.7"

/**
 * Identity of the client making the request. Mirrors the `X-AnyRouter-*`
 * headers the gateway reads in `inference-telemetry.ts`.
 */
export interface AppAttribution {
  /**
   * Stable machine identifier, becomes `generations.app_source`. Use a slug
   * (`anyr-cli`, `anyr-agent`), not a display name.
   */
  source?: string
  /** Human-readable name, becomes `generations.app_title`. */
  title?: string
  /** Client version, becomes `generations.app_version`. */
  version?: string
  /**
   * Curation categories (e.g. `cli-agent`). The gateway allowlists these and
   * keeps at most two per request; unknown values are dropped server-side.
   */
  categories?: string[]
  /**
   * Public URL identifying the app, sent as `HTTP-Referer`. Only meaningful for
   * apps that want to appear in the public app rankings.
   */
  url?: string
}

/** This provider's own identity, used when the caller supplies no `app`. */
export const PROVIDER_ATTRIBUTION: AppAttribution = {
  source: APP_SOURCE,
  title: APP_TITLE,
  version: APP_VERSION,
}

/**
 * Translate an {@link AppAttribution} into wire headers. Blank/whitespace-only
 * values are omitted rather than sent empty, so a partially-filled identity
 * never overwrites a good value with `""`.
 *
 * Returns `{}` when `app` is undefined, so callers that pass no `app` send no
 * attribution headers by default. This matches the provider contract in
 * `types.ts`: browser callers are attributed by Referer instead.
 */
export function buildAppAttributionHeaders(app: AppAttribution | undefined): Record<string, string> {
  if (!app) return {}
  const headers: Record<string, string> = {}
  const put = (name: string, value: string | undefined) => {
    const trimmed = value?.trim()
    if (trimmed) headers[name] = trimmed
  }
  put("X-AnyRouter-Source", app.source)
  put("X-AnyRouter-Title", app.title)
  put("X-AnyRouter-Version", app.version)
  put("HTTP-Referer", app.url)
  const categories = app.categories?.map((c) => c.trim()).filter(Boolean)
  if (categories?.length) headers["X-AnyRouter-Categories"] = categories.join(",")
  return headers
}
