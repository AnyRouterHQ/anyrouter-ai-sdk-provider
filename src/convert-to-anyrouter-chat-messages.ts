import type {
  LanguageModelV4FilePart,
  LanguageModelV4Message,
  LanguageModelV4Prompt,
  LanguageModelV4ToolCallPart,
  LanguageModelV4ToolResultOutput,
  LanguageModelV4ToolResultPart,
} from "@ai-sdk/provider"
import { UnsupportedFunctionalityError } from "@ai-sdk/provider"

// ─── OpenAI-compatible message shapes ─────────────────────────────────────

type TextContentPart = { type: "text"; text: string }
type ImageUrlContentPart = {
  type: "image_url"
  image_url: { url: string; detail?: "auto" | "low" | "high" }
}
type FileContentPart = {
  type: "file"
  file: { url?: string; data?: string; media_type?: string }
}
type UserContentPart = TextContentPart | ImageUrlContentPart | FileContentPart

type AssistantToolCall = {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

export type AnyRouterChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | UserContentPart[] }
  | {
      role: "assistant"
      content: string | null
      tool_calls?: AssistantToolCall[]
    }
  | { role: "tool"; tool_call_id: string; content: string }

/**
 * Convert a V4 prompt to an array of OpenAI-compatible chat messages.
 */
export function convertToAnyRouterChatMessages(
  prompt: LanguageModelV4Prompt,
): AnyRouterChatMessage[] {
  const messages: AnyRouterChatMessage[] = []

  for (const message of prompt) {
    switch (message.role) {
      case "system":
        messages.push({ role: "system", content: message.content })
        break

      case "user":
        messages.push(convertUserMessage(message))
        break

      case "assistant":
        messages.push(convertAssistantMessage(message))
        break

      case "tool":
        for (const part of message.content) {
          if (part.type === "tool-result") {
            messages.push(convertToolResultMessage(part))
          }
          // tool-approval-response is not representable in OpenAI format — skip
        }
        break

      default: {
        const _exhaustive: never = message
        throw new Error(`Unsupported message role: ${(_exhaustive as LanguageModelV4Message).role}`)
      }
    }
  }

  return messages
}

function convertUserMessage(
  message: Extract<LanguageModelV4Message, { role: "user" }>,
): AnyRouterChatMessage {
  // Single text part → collapse to string
  if (message.content.length === 1 && message.content[0].type === "text") {
    return { role: "user", content: message.content[0].text }
  }

  const parts: UserContentPart[] = []

  for (const part of message.content) {
    if (part.type === "text") {
      parts.push({ type: "text", text: part.text })
    } else if (part.type === "file") {
      const filePart = part as LanguageModelV4FilePart
      const mediaType = filePart.mediaType
      const url = fileDataToString(filePart, mediaType)

      if (mediaType.startsWith("image/")) {
        parts.push({ type: "image_url", image_url: { url } })
      } else {
        parts.push({ type: "file", file: { url, media_type: mediaType } })
      }
    } else {
      // Exhaustive: LanguageModelV4 user content is text | file | (ignored custom).
      // Cast to access type for the error message.
      const unknown = part as { type?: string }
      throw new UnsupportedFunctionalityError({
        functionality: `User message part type: ${unknown.type ?? "unknown"}`,
      })
    }
  }

  return { role: "user", content: parts }
}

function convertAssistantMessage(
  message: Extract<LanguageModelV4Message, { role: "assistant" }>,
): AnyRouterChatMessage {
  let text = ""
  const toolCalls: AssistantToolCall[] = []

  for (const part of message.content) {
    switch (part.type) {
      case "text":
        text += part.text
        break

      case "tool-call": {
        const tc = part as LanguageModelV4ToolCallPart
        toolCalls.push({
          id: tc.toolCallId,
          type: "function",
          function: {
            name: tc.toolName,
            arguments: typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input),
          },
        })
        break
      }

      // reasoning, file, reasoning-file, custom, tool-result inside assistant turn — skip
      default:
        break
    }
  }

  const result: Extract<AnyRouterChatMessage, { role: "assistant" }> = {
    role: "assistant",
    content: text || null,
  }

  if (toolCalls.length > 0) {
    result.tool_calls = toolCalls
  }

  return result
}

function convertToolResultMessage(part: LanguageModelV4ToolResultPart): AnyRouterChatMessage {
  return {
    role: "tool",
    tool_call_id: part.toolCallId,
    content: toolResultOutputToString(part.output),
  }
}

function toolResultOutputToString(output: LanguageModelV4ToolResultOutput): string {
  switch (output.type) {
    case "text":
      return output.value

    case "json":
      return JSON.stringify(output.value)

    case "error-text":
      return output.value

    case "error-json":
      return JSON.stringify(output.value)

    case "execution-denied":
      return output.reason ?? "Tool execution denied."

    case "content": {
      const segments: string[] = []
      for (const c of output.value) {
        if (c.type === "text") {
          segments.push(c.text)
        } else {
          segments.push(`[${c.type}]`)
        }
      }
      return segments.join("\n")
    }

    default:
      return JSON.stringify(output)
  }
}

/**
 * Convert a V4 `SharedV4FileData` discriminated union to a URL or data-URL
 * string suitable for use in an OpenAI-compatible message.
 *
 * V4 change from V3: `filePart.data` is now a tagged discriminated union
 * (`SharedV4FileData`) rather than a raw `string | Uint8Array | URL`.
 *
 * - `type: 'data'`      → base64-encode bytes or pass through base64 string
 * - `type: 'url'`       → use URL directly
 * - `type: 'reference'` → unsupported (provider-specific reference)
 * - `type: 'text'`      → encode as plain-text data URL
 */
function fileDataToString(filePart: LanguageModelV4FilePart, mediaType: string): string {
  const d = filePart.data
  switch (d.type) {
    case "data": {
      if (typeof d.data === "string") {
        // Already base64 — pass through or wrap in data URL.
        if (d.data.startsWith("data:")) return d.data
        return `data:${mediaType};base64,${d.data}`
      }
      // Uint8Array → base64 data URL
      return `data:${mediaType};base64,${uint8ArrayToBase64(d.data)}`
    }
    case "url":
      return d.url.toString()
    case "text":
      // Inline text content — encode as a data URL so downstream APIs receive it.
      return `data:${mediaType};base64,${btoa(d.text)}`
    case "reference":
      throw new UnsupportedFunctionalityError({
        functionality: "Provider file references (SharedV4FileDataReference) in chat messages",
      })
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
