import type {
  FilesV4,
  FilesV4UploadFileCallOptions,
  FilesV4UploadFileResult,
} from "@ai-sdk/provider"
import { type FileReferenceCache, fileDataVariantToUrl, hashFileData } from "./file-reference-cache"

/**
 * `FilesV4` implementation for the AnyRouter provider.
 *
 * ## How it works
 *
 * `uploadFile()` computes a SHA-256 hash of the file content and stores the
 * resolved data URL in a shared `FileReferenceCache`.  It returns a
 * `SharedV4ProviderReference` whose `anyrouter` key is that hash.
 *
 * When the same reference later appears as a `{ type: 'reference' }` file
 * part in a multi-step prompt, `convertToAnyRouterChatMessages` looks up the
 * hash in the cache and substitutes the stored URL — so the full file bytes
 * are never re-encoded on subsequent calls within the same provider session.
 *
 * ## Limitations (Phase 2)
 *
 * The cache is in-memory and scoped to the provider instance.  References do
 * not persist across process restarts.  A follow-up (Phase 3+) can wire this
 * to the AnyRouter gateway's `/files` endpoint to get durable, cross-session
 * file IDs that translate to `{ type: "file", file: { file_id: "…" } }` parts
 * for providers that support it (e.g. OpenAI).
 */
export class AnyRouterFiles implements FilesV4 {
  readonly specificationVersion = "v4" as const
  readonly provider: string

  private readonly cache: FileReferenceCache

  constructor(provider: string, cache: FileReferenceCache) {
    this.provider = provider
    this.cache = cache
  }

  /**
   * Register a file in the in-session cache and return a provider reference.
   *
   * Calling this multiple times with the same file content is idempotent —
   * the hash check prevents redundant re-encoding.
   */
  async uploadFile(options: FilesV4UploadFileCallOptions): Promise<FilesV4UploadFileResult> {
    const hash = await hashFileData(options.data)

    if (!this.cache.has(hash)) {
      const url = fileDataVariantToUrl(options.data, options.mediaType)
      this.cache.set(hash, { url, mediaType: options.mediaType })
    }

    return {
      providerReference: this.cache.referenceFor(hash),
      mediaType: options.mediaType,
      filename: options.filename,
      warnings: [],
    }
  }
}
