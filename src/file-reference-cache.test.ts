import { describe, expect, it } from "vitest"
import { FileReferenceCache, fileDataVariantToUrl, hashFileData } from "./file-reference-cache"

// ─── FileReferenceCache ───────────────────────────────────────────────────

describe("FileReferenceCache", () => {
  it("stores and retrieves an entry by anyrouter provider key", () => {
    const cache = new FileReferenceCache()
    const entry = { url: "data:image/png;base64,abc", mediaType: "image/png" }
    const ref = cache.set("hash-1", entry)

    expect(ref).toEqual({ anyrouter: "hash-1" })
    expect(cache.lookup(ref)).toEqual(entry)
  })

  it("returns undefined for unknown references", () => {
    const cache = new FileReferenceCache()
    expect(cache.lookup({ anyrouter: "no-such-hash" })).toBeUndefined()
  })

  it("returns undefined when reference has no anyrouter key", () => {
    const cache = new FileReferenceCache()
    cache.set("h", { url: "https://example.com/f.pdf", mediaType: "application/pdf" })
    // Reference from a different provider — should not match
    expect(cache.lookup({ openai: "file-xyz" })).toBeUndefined()
  })

  it("has() returns false before entry is stored", () => {
    const cache = new FileReferenceCache()
    expect(cache.has("not-yet")).toBe(false)
  })

  it("has() returns true after storing", () => {
    const cache = new FileReferenceCache()
    cache.set("h", { url: "data:text/plain;base64,SGVsbG8=", mediaType: "text/plain" })
    expect(cache.has("h")).toBe(true)
  })

  it("referenceFor() returns the correct reference without storing", () => {
    const cache = new FileReferenceCache()
    const ref = cache.referenceFor("some-hash")
    expect(ref).toEqual({ anyrouter: "some-hash" })
    // Nothing was stored
    expect(cache.has("some-hash")).toBe(false)
  })

  it("second set() for the same hash overwrites the entry", () => {
    const cache = new FileReferenceCache()
    cache.set("h", { url: "data:image/png;base64,old", mediaType: "image/png" })
    cache.set("h", { url: "data:image/png;base64,new", mediaType: "image/png" })
    expect(cache.lookup({ anyrouter: "h" })?.url).toBe("data:image/png;base64,new")
  })

  it("independent caches do not share entries", () => {
    const c1 = new FileReferenceCache()
    const c2 = new FileReferenceCache()
    c1.set("h", { url: "https://example.com/file", mediaType: "application/pdf" })
    expect(c2.lookup({ anyrouter: "h" })).toBeUndefined()
  })
})

// ─── hashFileData ─────────────────────────────────────────────────────────

describe("hashFileData()", () => {
  it("returns a 64-character hex string for Uint8Array data", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const hash = await hashFileData({ type: "data", data: bytes })
    expect(hash).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
  })

  it("returns a 64-character hex string for base64 string data", async () => {
    const hash = await hashFileData({ type: "data", data: "SGVsbG8=" })
    expect(hash).toHaveLength(64)
  })

  it("returns a 64-character hex string for text data", async () => {
    const hash = await hashFileData({ type: "text", text: "Hello world" })
    expect(hash).toHaveLength(64)
  })

  it("same Uint8Array bytes → same hash", async () => {
    const a = await hashFileData({ type: "data", data: new Uint8Array([10, 20, 30]) })
    const b = await hashFileData({ type: "data", data: new Uint8Array([10, 20, 30]) })
    expect(a).toBe(b)
  })

  it("same base64 string → same hash", async () => {
    const a = await hashFileData({ type: "data", data: "aGVsbG8=" })
    const b = await hashFileData({ type: "data", data: "aGVsbG8=" })
    expect(a).toBe(b)
  })

  it("same text → same hash", async () => {
    const a = await hashFileData({ type: "text", text: "hello" })
    const b = await hashFileData({ type: "text", text: "hello" })
    expect(a).toBe(b)
  })

  it("different content → different hashes", async () => {
    const a = await hashFileData({ type: "data", data: new Uint8Array([1]) })
    const b = await hashFileData({ type: "data", data: new Uint8Array([2]) })
    expect(a).not.toBe(b)
  })
})

// ─── fileDataVariantToUrl ─────────────────────────────────────────────────

describe("fileDataVariantToUrl()", () => {
  it("wraps a base64 string in a data URL", () => {
    const url = fileDataVariantToUrl({ type: "data", data: "SGVsbG8=" }, "application/pdf")
    expect(url).toBe("data:application/pdf;base64,SGVsbG8=")
  })

  it("passes through an already-formed data URL unchanged", () => {
    const existing = "data:image/png;base64,abc123"
    expect(fileDataVariantToUrl({ type: "data", data: existing }, "image/png")).toBe(existing)
  })

  it("encodes a Uint8Array as a base64 data URL", () => {
    // [72, 101, 108, 108, 111] = "Hello"
    const bytes = new Uint8Array([72, 101, 108, 108, 111])
    const url = fileDataVariantToUrl({ type: "data", data: bytes }, "text/plain")
    expect(url).toBe("data:text/plain;base64,SGVsbG8=")
  })

  it("encodes text as a base64 data URL", () => {
    const url = fileDataVariantToUrl({ type: "text", text: "Hello" }, "text/markdown")
    // btoa("Hello") === "SGVsbG8="
    expect(url).toBe("data:text/markdown;base64,SGVsbG8=")
  })
})
