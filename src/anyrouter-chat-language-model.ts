import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from "@ai-sdk/provider"
import type { ParseResult } from "@ai-sdk/provider-utils"
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  generateId,
  parseProviderOptions,
  postJsonToApi,
} from "@ai-sdk/provider-utils"
import { z } from "zod"
import { convertToAnyRouterChatMessages } from "./convert-to-anyrouter-chat-messages"
import type { AnyRouterProviderSettings } from "./types"

// ─── Provider options (per-call) ───────────────────────────────────────────

const anyRouterProviderOptionsSchema = z.object({
  /** Routing preference forwarded as `provider` in the request body. */
  provider: z.record(z.string(), z.unknown()).optional(),
  /** Session ID forwarded as `session_id` in the request body. */
  sessionId: z.string().optional(),
  /** Extra body fields merged in last (highest precedence). */
  extraBody: z.record(z.string(), z.unknown()).optional(),
})

type AnyRouterChatProviderOptions = z.infer<typeof anyRouterProviderOptionsSchema>

// ─── Zod schemas for response / chunk validation ───────────────────────────

const anyRouterErrorSchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
})

const completionUsageSchema = z.object({
  prompt_tokens: z.number().optional(),
  completion_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
})

const toolCallSchema = z.object({
  id: z.string().optional(),
  type: z.literal("function").optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.string().optional(),
    })
    .optional(),
})

const toolCallDeltaSchema = z.object({
  index: z.number(),
  id: z.string().optional(),
  type: z.literal("function").optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.string().optional(),
    })
    .optional(),
})

const messageSchema = z.object({
  content: z.string().nullish(),
  reasoning_content: z.string().nullish(),
  tool_calls: z.array(toolCallSchema).optional(),
})

const choiceSchema = z.object({
  message: messageSchema.optional(),
  finish_reason: z.string().nullish(),
})

const generateResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(choiceSchema).optional(),
  usage: completionUsageSchema.optional(),
})

const deltaSchema = z.object({
  content: z.string().nullish(),
  reasoning_content: z.string().nullish(),
  tool_calls: z.array(toolCallDeltaSchema).optional(),
})

const streamChoiceSchema = z.object({
  delta: deltaSchema.optional(),
  finish_reason: z.string().nullish(),
})

const streamChunkSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(streamChoiceSchema).optional(),
  usage: completionUsageSchema.optional(),
})

// ─── Finish reason mapping ─────────────────────────────────────────────────

function mapFinishReason(raw: string | null | undefined): LanguageModelV3FinishReason {
  switch (raw) {
    case "stop":
      return { unified: "stop", raw: raw }
    case "length":
    case "max_tokens":
      return { unified: "length", raw: raw }
    case "tool_calls":
    case "function_call":
      return { unified: "tool-calls", raw: raw }
    case "content_filter":
      return { unified: "content-filter", raw: raw }
    default:
      return { unified: "other", raw: raw ?? undefined }
  }
}

// ─── Usage conversion ──────────────────────────────────────────────────────

function buildUsage(
  raw:
    | {
        prompt_tokens?: number | null
        completion_tokens?: number | null
        total_tokens?: number | null
      }
    | undefined,
): LanguageModelV3Usage {
  return {
    inputTokens: {
      total: raw?.prompt_tokens ?? undefined,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: raw?.completion_tokens ?? undefined,
      text: undefined,
      reasoning: undefined,
    },
  }
}

// ─── Stream transform helpers ──────────────────────────────────────────────

type StreamChunk = z.infer<typeof streamChunkSchema>
type StreamChoice = z.infer<typeof streamChoiceSchema>
type ToolCallDelta = z.infer<typeof toolCallDeltaSchema>
type ToolCallAccumulator = Record<
  number,
  { id: string; name: string; arguments: string; started: boolean }
>
interface StreamState {
  activeTextId: string | null
  metadataEmitted: boolean
}
type StreamController = TransformStreamDefaultController<LanguageModelV3StreamPart>

/** Emit `response-metadata` once, on the first chunk carrying an id or model. */
function emitResponseMetadata(
  chunk: StreamChunk,
  state: StreamState,
  fallbackModelId: string,
  controller: StreamController,
): void {
  if (state.metadataEmitted || !(chunk.id || chunk.model)) return
  state.metadataEmitted = true
  controller.enqueue({
    type: "response-metadata",
    id: chunk.id,
    modelId: chunk.model ?? fallbackModelId,
  })
}

/** Emit a text delta, opening a text block on first content. */
function emitTextDelta(content: string, state: StreamState, controller: StreamController): void {
  if (state.activeTextId === null) {
    state.activeTextId = generateId()
    controller.enqueue({ type: "text-start", id: state.activeTextId })
  }
  controller.enqueue({ type: "text-delta", id: state.activeTextId, delta: content })
}

/** Accumulate tool-call deltas by index and emit tool-input start/delta parts. */
function emitToolCallDeltas(
  toolCalls: ToolCallDelta[],
  acc: ToolCallAccumulator,
  controller: StreamController,
): void {
  for (const tcDelta of toolCalls) {
    const idx = tcDelta.index
    if (!acc[idx]) acc[idx] = { id: "", name: "", arguments: "", started: false }
    const entry = acc[idx]
    if (tcDelta.id) entry.id = tcDelta.id
    if (tcDelta.function?.name) entry.name = tcDelta.function.name
    if (tcDelta.function?.arguments) entry.arguments += tcDelta.function.arguments

    const toolId = entry.id || `tool-${idx}`
    if (!entry.started && entry.name) {
      entry.started = true
      controller.enqueue({ type: "tool-input-start", id: toolId, toolName: entry.name })
    }
    if (tcDelta.function?.arguments) {
      controller.enqueue({
        type: "tool-input-delta",
        id: toolId,
        delta: tcDelta.function.arguments,
      })
    }
  }
}

/** Close any open text + tool blocks and emit the final `finish` part. */
function emitFinish(
  choice: StreamChoice,
  chunk: StreamChunk,
  state: StreamState,
  acc: ToolCallAccumulator,
  controller: StreamController,
): void {
  if (state.activeTextId !== null) {
    controller.enqueue({ type: "text-end", id: state.activeTextId })
    state.activeTextId = null
  }
  for (const [idxStr, entry] of Object.entries(acc)) {
    if (!entry.started) continue
    const toolId = entry.id || `tool-${idxStr}`
    controller.enqueue({ type: "tool-input-end", id: toolId })
    controller.enqueue({
      type: "tool-call",
      toolCallId: toolId,
      toolName: entry.name,
      input: entry.arguments,
    })
  }
  controller.enqueue({
    type: "finish",
    usage: buildUsage(chunk.usage),
    finishReason: mapFinishReason(choice.finish_reason),
  })
}

// ─── Tool-choice mapping ───────────────────────────────────────────────────

type OpenAIToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } }

function mapToolChoice(
  toolChoice: LanguageModelV3CallOptions["toolChoice"],
): OpenAIToolChoice | undefined {
  if (!toolChoice) return undefined
  switch (toolChoice.type) {
    case "auto":
      return "auto"
    case "none":
      return "none"
    case "required":
      return "required"
    case "tool":
      return { type: "function", function: { name: toolChoice.toolName } }
  }
}

// ─── Request body builder helpers ─────────────────────────────────────────

type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: unknown }

function buildResponseFormat(
  responseFormat: LanguageModelV3CallOptions["responseFormat"],
): ResponseFormat | undefined {
  if (!responseFormat) return undefined
  if (responseFormat.type === "text") return { type: "text" }
  if (responseFormat.type === "json") {
    if (responseFormat.schema) {
      return {
        type: "json_schema",
        json_schema: {
          name: responseFormat.name ?? "response",
          description: responseFormat.description,
          schema: responseFormat.schema,
          strict: true,
        },
      }
    }
    return { type: "json_object" }
  }
  return undefined
}

function buildTools(
  tools: LanguageModelV3CallOptions["tools"],
): Array<{ type: "function"; function: unknown }> | undefined {
  if (!tools || tools.length === 0) return undefined
  const fns = tools
    .filter((t) => t.type === "function")
    .map((t) => ({
      type: "function" as const,
      function: {
        name: (t as { name: string }).name,
        description: (t as { description?: string }).description,
        parameters: (t as { inputSchema: unknown }).inputSchema,
        strict: (t as { strict?: boolean }).strict,
      },
    }))
  return fns.length > 0 ? fns : undefined
}

// ─── Request body builder ──────────────────────────────────────────────────

function buildRequestBody(
  modelId: string,
  options: LanguageModelV3CallOptions,
  settings: AnyRouterProviderSettings,
  stream: boolean,
  perCallOptions: AnyRouterChatProviderOptions,
): Record<string, unknown> {
  const messages = convertToAnyRouterChatMessages(options.prompt)
  const responseFormat = buildResponseFormat(options.responseFormat)
  const tools = buildTools(options.tools)
  const toolChoice = mapToolChoice(options.toolChoice)

  // Merge routing / session / extra from settings and per-call options
  const provider = perCallOptions.provider ?? settings.provider
  const sessionId = perCallOptions.sessionId ?? settings.sessionId
  const extraBody = { ...settings.extraBody, ...perCallOptions.extraBody }

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
    ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
    max_tokens: options.maxOutputTokens,
    temperature: options.temperature,
    top_p: options.topP,
    top_k: options.topK,
    stop: options.stopSequences,
    frequency_penalty: options.frequencyPenalty,
    presence_penalty: options.presencePenalty,
    seed: options.seed,
    response_format: responseFormat,
    tools,
    tool_choice: toolChoice,
    provider: provider ?? undefined,
    session_id: sessionId ?? undefined,
    ...extraBody,
  }

  // Strip undefined values
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) delete body[key]
  }

  return body
}

// ─── AnyRouterChatLanguageModel ────────────────────────────────────────────

export interface AnyRouterChatConfig {
  provider: string
  baseURL: string
  headers: () => Record<string, string | undefined>
  fetch?: typeof globalThis.fetch
  settings: AnyRouterProviderSettings
}

export class AnyRouterChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3" as const
  readonly provider: string
  readonly modelId: string
  readonly supportedUrls: Record<string, RegExp[]> = {}

  private readonly config: AnyRouterChatConfig

  constructor(modelId: string, config: AnyRouterChatConfig) {
    this.modelId = modelId
    this.provider = config.provider
    this.config = config
  }

  // ─── doGenerate ─────────────────────────────────────────────────────────

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const perCallOptions: AnyRouterChatProviderOptions =
      (await parseProviderOptions({
        provider: "anyrouter",
        providerOptions: options.providerOptions,
        schema: anyRouterProviderOptionsSchema,
      })) ?? {}

    const body = buildRequestBody(
      this.modelId,
      options,
      this.config.settings,
      false,
      perCallOptions,
    )

    const { value: response, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: anyRouterErrorSchema,
        errorToMessage: (data) => data.error?.message ?? "AnyRouter API error",
        isRetryable: (response) => response.status >= 500,
      }),
      successfulResponseHandler: createJsonResponseHandler(generateResponseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const choice = response.choices?.[0]
    const message = choice?.message

    const content: LanguageModelV3GenerateResult["content"] = []

    if (message?.content) {
      content.push({ type: "text", text: message.content })
    }

    if (message?.tool_calls && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        if (tc.id && tc.function?.name) {
          content.push({
            type: "tool-call",
            toolCallId: tc.id,
            toolName: tc.function.name,
            input: tc.function.arguments ?? "{}",
          })
        }
      }
    }

    return {
      content,
      finishReason: mapFinishReason(choice?.finish_reason),
      usage: buildUsage(response.usage),
      warnings: [],
      request: { body },
      response: {
        id: response.id,
        modelId: response.model,
        headers: responseHeaders,
      },
    }
  }

  // ─── doStream ───────────────────────────────────────────────────────────

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const perCallOptions: AnyRouterChatProviderOptions =
      (await parseProviderOptions({
        provider: "anyrouter",
        providerOptions: options.providerOptions,
        schema: anyRouterProviderOptionsSchema,
      })) ?? {}

    const body = buildRequestBody(this.modelId, options, this.config.settings, true, perCallOptions)

    const { value: stream, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: anyRouterErrorSchema,
        errorToMessage: (data) => data.error?.message ?? "AnyRouter API error",
        isRetryable: (response) => response.status >= 500,
      }),
      successfulResponseHandler: createEventSourceResponseHandler(streamChunkSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const toolCallAccumulator: ToolCallAccumulator = {}
    const state: StreamState = { activeTextId: null, metadataEmitted: false }
    const selfModelId = this.modelId

    const transformStream = new TransformStream<
      ParseResult<z.infer<typeof streamChunkSchema>>,
      LanguageModelV3StreamPart
    >({
      start(controller) {
        controller.enqueue({ type: "stream-start", warnings: [] })
      },

      transform(chunkResult, controller) {
        if (!chunkResult.success) {
          controller.enqueue({ type: "error", error: chunkResult.error })
          return
        }

        const chunk = chunkResult.value
        const choice = chunk.choices?.[0]

        emitResponseMetadata(chunk, state, selfModelId, controller)

        const delta = choice?.delta
        if (delta) {
          if (typeof delta.content === "string" && delta.content.length > 0) {
            emitTextDelta(delta.content, state, controller)
          }
          if (delta.tool_calls) {
            emitToolCallDeltas(delta.tool_calls, toolCallAccumulator, controller)
          }
        }

        if (choice?.finish_reason) {
          emitFinish(choice, chunk, state, toolCallAccumulator, controller)
        }
      },

      flush(controller) {
        if (state.activeTextId !== null) {
          controller.enqueue({ type: "text-end", id: state.activeTextId })
        }
      },
    })

    return {
      stream: stream.pipeThrough(transformStream),
      request: { body },
      response: { headers: responseHeaders },
    }
  }
}
