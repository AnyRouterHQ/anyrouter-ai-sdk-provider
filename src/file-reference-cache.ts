import type {
  SharedV4FileDataData,
  SharedV4FileDataText,
  SharedV4ProviderReference,
} from "@ai-sdk/provider"

/**
 * The AnyRouter-namespaced key used inside `SharedV4ProviderReference` objects.
 * References created by this provider store a SHA-256 hex hash under this key.
 */
const PROVIDER_KEY = "anyrouter"

/**
 * The resolved representation of a cached file — a URL string ready to drop
 * into an OpenAI-compatible message part and the media type that accompanies it.
 */
export type ResolvedFileEntry = {
  /** Ready-to-use string: a data URL (`data:<mime>;base64,…`) or an https URL. */
  url: string
  mediaType: string
}

/**
 * In-session file reference cache.
 *
 * Files are keyed by a SHA-256 hex hash of their content.  A single provider
 * instance shares one cache, so the same binary content is never encoded or
 * stored more than once within an agent loop — even across multiple `doGenerate`
 * / `doStream` calls.
 *
 * This class is intentionally free of I/O and network calls.  All async
 * behaviour lives in the `hashFileData` helper below.
 */
export class FileReferenceCache {
  private readonly store = new Map<string, ResolvedFileEntry>()

  /**
   * Look up a cached entry via a `SharedV4ProviderReference`.
   * Returns `undefined` when the reference was not created by this cache.
   */
  lookup(reference: SharedV4ProviderReference): ResolvedFileEntry | undefined {
    const hash = reference[PROVIDER_KEY]
    return hash ? this.store.get(hash) : undefined
  }

  /** Add an entry and return the corresponding provider reference. */
  set(hash: string, entry: ResolvedFileEntry): SharedV4ProviderReference {
    this.store.set(hash, entry)
    return { [PROVIDER_KEY]: hash }
  }

  /** Returns true when the content hash is already cached. */
  has(hash: string): boolean {
    return this.store.has(hash)
  }

  /**
   * Build a `SharedV4ProviderReference` for the given hash without writing
   * to the cache.  Use this to construct the return value of `uploadFile`
   * after confirming the hash is already stored.
   */
  referenceFor(hash: string): SharedV4ProviderReference {
    return { [PROVIDER_KEY]: hash }
  }
}

/**
 * Compute a stable cache key for a file data variant.
 *
 * - `{ type: 'data' }` → SHA-256 of the raw bytes (or the base64 string bytes).
 * - `{ type: 'text' }` → SHA-256 of the UTF-8 encoded text.
 *
 * Returns a lowercase hex string.
 */
export async function hashFileData(
  data: SharedV4FileDataData | SharedV4FileDataText,
): Promise<string> {
  let bytes: Uint8Array
  if (data.type === "text") {
    bytes = new TextEncoder().encode(data.text)
  } else if (typeof data.data === "string") {
    // Hash the base64 string as-is so equivalent encodings produce the same key.
    bytes = new TextEncoder().encode(data.data)
  } else {
    bytes = data.data
  }

  // The `Uint8Array<ArrayBufferLike>` generic causes a type-narrowing issue in
  // strict TypeScript when passing to `crypto.subtle.digest`.  Wrapping in
  // `Uint8Array.from` coerces to `Uint8Array<ArrayBuffer>` which satisfies
  // the `BufferSource` constraint.
  const hashBuffer = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Convert a `SharedV4FileDataData` or `SharedV4FileDataText` variant into the
 * URL string used inside an OpenAI-compatible content part.
 *
 * - `{ type: 'data', data: Uint8Array | string }` → `data:<mediaType>;base64,…`
 * - `{ type: 'text', text }` → `data:<mediaType>;base64,…` (UTF-8 base64)
 */
export function fileDataVariantToUrl(
  data: SharedV4FileDataData | SharedV4FileDataText,
  mediaType: string,
): string {
  if (data.type === "text") {
    return `data:${mediaType};base64,${btoa(data.text)}`
  }
  if (typeof data.data === "string") {
    if (data.data.startsWith("data:")) return data.data
    return `data:${mediaType};base64,${data.data}`
  }
  // Uint8Array → base64
  let binary = ""
  for (let i = 0; i < data.data.length; i++) {
    binary += String.fromCharCode(data.data[i])
  }
  return `data:${mediaType};base64,${btoa(binary)}`
}
