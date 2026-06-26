import { describe, expect, it } from "vitest"
import { AnyRouterFiles } from "./anyrouter-files"
import { FileReferenceCache } from "./file-reference-cache"

function makeFiles(): { files: AnyRouterFiles; cache: FileReferenceCache } {
  const cache = new FileReferenceCache()
  const files = new AnyRouterFiles("anyrouter", cache)
  return { files, cache }
}

describe("AnyRouterFiles", () => {
  it("implements FilesV4 with the correct specificationVersion and provider", () => {
    const { files } = makeFiles()
    expect(files.specificationVersion).toBe("v4")
    expect(files.provider).toBe("anyrouter")
  })

  // ─── uploadFile ──────────────────────────────────────────────────────────

  it("returns a provider reference with anyrouter key for data (Uint8Array)", async () => {
    const { files } = makeFiles()
    const result = await files.uploadFile({
      data: { type: "data", data: new Uint8Array([1, 2, 3]) },
      mediaType: "application/pdf",
    })
    expect(result.providerReference).toMatchObject({ anyrouter: expect.any(String) })
    expect(result.warnings).toEqual([])
  })

  it("passes mediaType and filename through to the result", async () => {
    const { files } = makeFiles()
    const result = await files.uploadFile({
      data: { type: "data", data: new Uint8Array([4, 5, 6]) },
      mediaType: "image/png",
      filename: "photo.png",
    })
    expect(result.mediaType).toBe("image/png")
    expect(result.filename).toBe("photo.png")
  })

  it("populates the shared cache so lookup() works", async () => {
    const { files, cache } = makeFiles()
    const result = await files.uploadFile({
      data: { type: "data", data: new Uint8Array([7, 8, 9]) },
      mediaType: "text/plain",
    })
    const entry = cache.lookup(result.providerReference)
    expect(entry).toBeDefined()
    expect(entry?.mediaType).toBe("text/plain")
    expect(entry?.url).toContain("data:text/plain;base64,")
  })

  it("is idempotent: uploading the same file twice returns the same reference", async () => {
    const { files } = makeFiles()
    const bytes = new Uint8Array([10, 20, 30])
    const r1 = await files.uploadFile({
      data: { type: "data", data: bytes },
      mediaType: "image/jpeg",
    })
    const r2 = await files.uploadFile({
      data: { type: "data", data: bytes },
      mediaType: "image/jpeg",
    })
    expect(r1.providerReference).toEqual(r2.providerReference)
  })

  it("different content produces different references", async () => {
    const { files } = makeFiles()
    const r1 = await files.uploadFile({
      data: { type: "data", data: new Uint8Array([1]) },
      mediaType: "image/png",
    })
    const r2 = await files.uploadFile({
      data: { type: "data", data: new Uint8Array([2]) },
      mediaType: "image/png",
    })
    expect(r1.providerReference).not.toEqual(r2.providerReference)
  })

  it("supports text data type", async () => {
    const { files, cache } = makeFiles()
    const result = await files.uploadFile({
      data: { type: "text", text: "# Hello" },
      mediaType: "text/markdown",
    })
    const entry = cache.lookup(result.providerReference)
    expect(entry?.url).toContain("data:text/markdown;base64,")
  })

  it("supports base64 string data type", async () => {
    const { files, cache } = makeFiles()
    // SGVsbG8= is base64 for "Hello"
    const result = await files.uploadFile({
      data: { type: "data", data: "SGVsbG8=" },
      mediaType: "application/pdf",
    })
    const entry = cache.lookup(result.providerReference)
    expect(entry?.url).toBe("data:application/pdf;base64,SGVsbG8=")
  })

  it("second uploadFile call for same hash does NOT re-encode the data", async () => {
    const { files, cache } = makeFiles()
    const bytes = new Uint8Array([99])
    const r1 = await files.uploadFile({
      data: { type: "data", data: bytes },
      mediaType: "image/png",
    })

    // Verify it's in the cache
    const entryBefore = cache.lookup(r1.providerReference)

    const r2 = await files.uploadFile({
      data: { type: "data", data: bytes },
      mediaType: "image/png",
    })

    // Reference unchanged — cached entry was reused
    expect(r1.providerReference).toEqual(r2.providerReference)
    expect(cache.lookup(r2.providerReference)).toEqual(entryBefore)
  })
})
