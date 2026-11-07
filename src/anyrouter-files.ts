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
    // Support streaming uploads (`{ type: 'stream', stream }`, @ai-sdk/provider
    // >= 4.0.36): the cache keys on content hash, so buffer the stream first.
    let data = options.data
    if (data.type === "stream") {
      const bytes = await readAllBytes(data.stream, options.abortSignal)
      data = { type: "data", data: bytes }
    }
    const hash = await hashFileData(data)

    if (!this.cache.has(hash)) {
      const url = fileDataVariantToUrl(data, options.mediaType)
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

/** Buffer a byte stream fully. The in-session cache must hash content, so streaming stays zero-copy only for providers that speak the gateway bytes directly. */
export async function readAllBytes(stream: ReadableStream<Uint8Array>, abortSignal?: AbortSignal): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      if (abortSignal?.aborted) throw abortSignal.reason ?? new Error("Aborted")
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}
