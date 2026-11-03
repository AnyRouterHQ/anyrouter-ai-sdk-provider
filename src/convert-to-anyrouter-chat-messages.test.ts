import type { LanguageModelV4FilePart } from "@ai-sdk/provider"
import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { convertToAnyRouterChatMessages } from "./convert-to-anyrouter-chat-messages"
import { FileReferenceCache } from "./file-reference-cache"

function filePart(
  data: LanguageModelV4FilePart["data"],
  mediaType: string,
): LanguageModelV4FilePart {
  return { type: "file", data, mediaType }
}

function userMsg(content: LanguageModelV4FilePart["data"], mediaType: string) {
  return convertToAnyRouterChatMessages([{ role: "user", content: [filePart(content, mediaType)] }])
}

describe("convertToAnyRouterChatMessages — file parts", () => {
  describe("data discriminant (Uint8Array → base64 data URL)", () => {
    it("converts Uint8Array image to image_url part", () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
      const msgs = userMsg({ type: "data", data: bytes }, "image/png")
      const content = (msgs[0] as { content: unknown[] }).content
      expect(content).toHaveLength(1)
      expect(content[0]).toEqual({
        type: "image_url",
        image_url: { url: "data:image/png;base64,SGVsbG8=" },
      })
    })

    it("converts Uint8Array PDF to file part", () => {
      const bytes = new Uint8Array([1, 2, 3])
      const msgs = userMsg({ type: "data", data: bytes }, "application/pdf")
      const content = (msgs[0] as { content: unknown[] }).content
      expect(content[0]).toMatchObject({
        type: "file",
        file: { media_type: "application/pdf" },
      })
      expect((content[0] as { file: { url: string } }).file.url).toContain(
        "data:application/pdf;base64,",
      )
    })

    it("passes through an existing data URL unchanged", () => {
      const dataUrl = "data:image/jpeg;base64,/9j/existing"
      const msgs = userMsg({ type: "data", data: dataUrl }, "image/jpeg")
      const content = (msgs[0] as { content: unknown[] }).content
      expect((content[0] as { image_url: { url: string } }).image_url.url).toBe(dataUrl)
    })

    it("wraps a bare base64 string in a data URL", () => {
      const msgs = userMsg({ type: "data", data: "SGVsbG8=" }, "image/png")
      const content = (msgs[0] as { content: unknown[] }).content
      expect((content[0] as { image_url: { url: string } }).image_url.url).toBe(
        "data:image/png;base64,SGVsbG8=",
      )
    })
  })

  describe("url discriminant", () => {
    it("passes an https URL through as image_url for image media types", () => {
      const msgs = userMsg(
        { type: "url", url: new URL("https://example.com/photo.jpg") },
        "image/jpeg",
      )
      const content = (msgs[0] as { content: unknown[] }).content
      expect(content[0]).toEqual({
        type: "image_url",
        image_url: { url: "https://example.com/photo.jpg" },
      })
    })

    it("passes an https URL through as file part for non-image media types", () => {
      const msgs = userMsg(
        { type: "url", url: new URL("https://example.com/report.pdf") },
        "application/pdf",
      )
      const content = (msgs[0] as { content: unknown[] }).content
      expect(content[0]).toEqual({
        type: "file",
        file: { url: "https://example.com/report.pdf", media_type: "application/pdf" },
      })
    })
  })

  describe("text discriminant", () => {
    it("encodes inline text as a base64 data URL", () => {
      const msgs = userMsg({ type: "text", text: "Hello" }, "text/plain")
      const content = (msgs[0] as { content: unknown[] }).content
      // btoa("Hello") === "SGVsbG8="
      expect(content[0]).toEqual({
        type: "file",
        file: { url: "data:text/plain;base64,SGVsbG8=", media_type: "text/plain" },
      })
    })
  })

  describe("reference discriminant", () => {
    it("throws UnsupportedFunctionalityError when no cache is provided", () => {
      expect(() =>
        userMsg({ type: "reference", reference: { anyrouter: "some-hash" } }, "image/png"),
      ).toThrow(UnsupportedFunctionalityError)
    })

    it("throws UnsupportedFunctionalityError when the reference is not in the cache", () => {
      const cache = new FileReferenceCache()
      // Cache is empty — lookup will return undefined
      expect(() =>
        convertToAnyRouterChatMessages(
          [
            {
              role: "user",
              content: [
                filePart(
                  { type: "reference", reference: { anyrouter: "unknown-hash" } },
                  "image/png",
                ),
              ],
            },
          ],
          cache,
        ),
      ).toThrow(UnsupportedFunctionalityError)
    })

    it("resolves a cached image reference to an image_url part", () => {
      const cache = new FileReferenceCache()
      cache.set("img-hash", { url: "data:image/png;base64,abc", mediaType: "image/png" })

      const msgs = convertToAnyRouterChatMessages(
        [
          {
            role: "user",
            content: [
              filePart({ type: "reference", reference: { anyrouter: "img-hash" } }, "image/png"),
            ],
          },
        ],
        cache,
      )
      const content = (msgs[0] as { content: unknown[] }).content
      expect(content[0]).toEqual({
        type: "image_url",
        image_url: { url: "data:image/png;base64,abc" },
      })
    })

    it("resolves a cached PDF reference to a file part", () => {
      const cache = new FileReferenceCache()
      cache.set("pdf-hash", {
        url: "data:application/pdf;base64,JVBERi0x",
        mediaType: "application/pdf",
      })

      const msgs = convertToAnyRouterChatMessages(
        [
          {
            role: "user",
            content: [
              filePart(
                { type: "reference", reference: { anyrouter: "pdf-hash" } },
                "application/pdf",
              ),
            ],
          },
        ],
        cache,
      )
      const content = (msgs[0] as { content: unknown[] }).content
      expect(content[0]).toEqual({
        type: "file",
        file: {
          url: "data:application/pdf;base64,JVBERi0x",
          media_type: "application/pdf",
        },
      })
    })

    it("reuses the same cached URL across multiple messages", () => {
      const cache = new FileReferenceCache()
      cache.set("h", { url: "https://cdn.example.com/img.png", mediaType: "image/png" })

      const ref = { type: "reference" as const, reference: { anyrouter: "h" } }
      const msgs = convertToAnyRouterChatMessages(
        [
          { role: "user", content: [filePart(ref, "image/png")] },
          { role: "user", content: [filePart(ref, "image/png")] },
        ],
        cache,
      )

      const url0 = (
        (msgs[0] as { content: { image_url: { url: string } }[] }).content[0] as {
          image_url: { url: string }
        }
      ).image_url.url
      const url1 = (
        (msgs[1] as { content: { image_url: { url: string } }[] }).content[0] as {
          image_url: { url: string }
        }
      ).image_url.url

      expect(url0).toBe("https://cdn.example.com/img.png")
      expect(url1).toBe(url0)
    })
  })

  describe("integration: provider.files().uploadFile() → convertToAnyRouterChatMessages()", () => {
    it("round-trips: a file uploaded via uploadFile is resolved in message conversion", async () => {
      const { AnyRouterFiles } = await import("./anyrouter-files")
      const cache = new FileReferenceCache()
      const filesInterface = new AnyRouterFiles("anyrouter", cache)

      const uploadResult = await filesInterface.uploadFile({
        data: { type: "data", data: new Uint8Array([1, 2, 3]) },
        mediaType: "image/png",
      })

      // Use the reference in a prompt
      const msgs = convertToAnyRouterChatMessages(
        [
          {
            role: "user",
            content: [
              filePart(
                { type: "reference", reference: uploadResult.providerReference },
                "image/png",
              ),
            ],
          },
        ],
        cache,
      )

      const content = (msgs[0] as { content: unknown[] }).content
      expect(content).toHaveLength(1)
      expect((content[0] as { type: string }).type).toBe("image_url")
      expect((content[0] as { image_url: { url: string } }).image_url.url).toContain(
        "data:image/png;base64,",
      )
    })
  })
})
