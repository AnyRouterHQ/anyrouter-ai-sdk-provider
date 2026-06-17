import type {
  LanguageModelV3FilePart,
  LanguageModelV3Message,
  LanguageModelV3Prompt,
  LanguageModelV3ToolCallPart,
  LanguageModelV3ToolResultOutput,
  LanguageModelV3ToolResultPart,
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
 * Convert a V3 prompt to an array of OpenAI-compatible chat messages.
 */
export function convertToAnyRouterChatMessages(
  prompt: LanguageModelV3Prompt,
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
        throw new Error(`Unsupported message role: ${(_exhaustive as LanguageModelV3Message).role}`)
      }
    }
  }

  return messages
}

function convertUserMessage(
  message: Extract<LanguageModelV3Message, { role: "user" }>,
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
      const filePart = part as LanguageModelV3FilePart
      const mediaType = filePart.mediaType
      const url = toDataUrlOrString(filePart.data, mediaType)

      if (mediaType.startsWith("image/")) {
        parts.push({ type: "image_url", image_url: { url } })
      } else {
        parts.push({ type: "file", file: { url, media_type: mediaType } })
      }
    } else {
      // Exhaustive: LanguageModelV3Message user content is only text | file.
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
  message: Extract<LanguageModelV3Message, { role: "assistant" }>,
): AnyRouterChatMessage {
  let text = ""
  const toolCalls: AssistantToolCall[] = []

  for (const part of message.content) {
    switch (part.type) {
      case "text":
        text += part.text
        break

      case "tool-call": {
        const tc = part as LanguageModelV3ToolCallPart
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

      // reasoning, file, tool-result inside assistant turn — skip
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

function convertToolResultMessage(part: LanguageModelV3ToolResultPart): AnyRouterChatMessage {
  return {
    role: "tool",
    tool_call_id: part.toolCallId,
    content: toolResultOutputToString(part.output),
  }
}

function toolResultOutputToString(output: LanguageModelV3ToolResultOutput): string {
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

function toDataUrlOrString(data: string | Uint8Array | URL, mediaType: string): string {
  if (data instanceof URL) return data.toString()
  if (typeof data === "string") {
    if (data.startsWith("http") || data.startsWith("data:")) return data
    return `data:${mediaType};base64,${data}`
  }
  return `data:${mediaType};base64,${uint8ArrayToBase64(data)}`
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
