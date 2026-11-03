import {
  APICallError,
  type LanguageModelV4,
  type LanguageModelV4CallOptions,
  type LanguageModelV4FinishReason,
  type LanguageModelV4GenerateResult,
  type LanguageModelV4StreamPart,
  type LanguageModelV4StreamResult,
  type LanguageModelV4Usage,
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
import type { FileReferenceCache } from "./file-reference-cache"
import type { AnyRouterProviderSettings } from "./types"

const anyRouterProviderOptionsSchema = z.object({
  /** Routing preference forwarded as `provider` in the request body. */
  provider: z.record(z.string(), z.unknown()).optional(),
  /** Session ID forwarded as `session_id` in the request body. */
  sessionId: z.string().optional(),
  /** Extra body fields merged in last (highest precedence). */
  extraBody: z.record(z.string(), z.unknown()).optional(),
  /** Cache this response for N seconds, forwarded as the `cf-aig-cache-ttl` header. */
  cacheTtl: z.number().optional(),
  /** Skip response caching for this call, forwarded as `cf-aig-skip-cache: true`. */
  skipCache: z.boolean().optional(),
})

type AnyRouterChatProviderOptions = z.infer<typeof anyRouterProviderOptionsSchema>

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
  tool_calls: z.array(toolCallSchema).nullish(),
})

const choiceSchema = z.object({
  message: messageSchema.optional(),
  finish_reason: z.string().nullish(),
})

const generateResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(choiceSchema).optional(),
  usage: completionUsageSchema.nullish(),
})

const deltaSchema = z.object({
  content: z.string().nullish(),
  reasoning_content: z.string().nullish(),
  tool_calls: z.array(toolCallDeltaSchema).nullish(),
})

const streamChoiceSchema = z.object({
  delta: deltaSchema.optional(),
  finish_reason: z.string().nullish(),
})

const streamChunkSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z.array(streamChoiceSchema).optional(),
  usage: completionUsageSchema.nullish(),
  // A mid-stream failure arrives as a `data: {"error":{...}}` frame on a 200
  // response, in the same envelope the gateway uses for non-2xx bodies.
  error: anyRouterErrorSchema.shape.error,
})

function mapFinishReason(raw: string | null | undefined): LanguageModelV4FinishReason {
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
    case "error":
      return { unified: "error", raw: raw }
    default:
      return { unified: "other", raw: raw ?? undefined }
  }
}

function buildUsage(
  raw:
    | {
        prompt_tokens?: number | null
        completion_tokens?: number | null
        total_tokens?: number | null
      }
    | null
    | undefined,
): LanguageModelV4Usage {
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

/**
 * Map the AI SDK 7 portable `reasoning` parameter to the AnyRouter gateway's
 * `reasoning_effort` field.
 *
 * Gateway values: "none" | "minimal" | "low" | "medium" | "high"
 * AI SDK values:  "provider-default" | "none" | "minimal" | "low" | "medium" | "high" | "xhigh"
 *
 * - "provider-default" → omit the field (let the gateway use its default)
 * - "xhigh" → "high" (gateway maximum)
 * - others → pass through verbatim
 */
function mapReasoningEffort(
  reasoning: LanguageModelV4CallOptions["reasoning"],
): string | undefined {
  if (!reasoning || reasoning === "provider-default") return undefined
  if (reasoning === "xhigh") return "high"
  return reasoning
}

type StreamChunk = z.infer<typeof streamChunkSchema>
type StreamChoice = z.infer<typeof streamChoiceSchema>
type ToolCallDelta = z.infer<typeof toolCallDeltaSchema>
type ToolCallAccumulator = Record<
  number,
  { id: string; name: string; arguments: string; started: boolean }
>
interface StreamState {
  activeTextId: string | null
  activeReasoningId: string | null
  metadataEmitted: boolean
}
type StreamController = TransformStreamDefaultController<LanguageModelV4StreamPart>

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

/** Close an open reasoning block, if any. */
function closeReasoning(state: StreamState, controller: StreamController): void {
  if (state.activeReasoningId !== null) {
    controller.enqueue({ type: "reasoning-end", id: state.activeReasoningId })
    state.activeReasoningId = null
  }
}

/** Emit a reasoning delta, opening a reasoning block on first content. */
function emitReasoningDelta(
  content: string,
  state: StreamState,
  controller: StreamController,
): void {
  if (state.activeReasoningId === null) {
    state.activeReasoningId = generateId()
    controller.enqueue({ type: "reasoning-start", id: state.activeReasoningId })
  }
  controller.enqueue({ type: "reasoning-delta", id: state.activeReasoningId, delta: content })
}

/** Emit a text delta, opening a text block on first content. */
function emitTextDelta(content: string, state: StreamState, controller: StreamController): void {
  // Reasoning precedes the answer; close it once visible text begins.
  closeReasoning(state, controller)
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

function emitDelta(
  delta: NonNullable<StreamChoice["delta"]>,
  state: StreamState,
  acc: ToolCallAccumulator,
  controller: StreamController,
): void {
  if (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) {
    emitReasoningDelta(delta.reasoning_content, state, controller)
  }
  if (typeof delta.content === "string" && delta.content.length > 0) {
    emitTextDelta(delta.content, state, controller)
  }
  if (delta.tool_calls) {
    emitToolCallDeltas(delta.tool_calls, acc, controller)
  }
}

/**
 * An `APICallError` keeps the envelope in `responseBody`, so callers recover
 * the gateway `code` and `message` the same way they do for a non-2xx body.
 */
function errorFramePart(
  chunk: StreamChunk,
  request: { url: string; body: unknown; responseHeaders?: Record<string, string> },
): LanguageModelV4StreamPart {
  return {
    type: "error",
    error: new APICallError({
      message: chunk.error?.message ?? "AnyRouter API error",
      url: request.url,
      requestBodyValues: request.body,
      responseHeaders: request.responseHeaders,
      responseBody: JSON.stringify(chunk),
      data: chunk,
    }),
  }
}

/** Close any open text + tool blocks and emit the final `finish` part. */
function emitFinish(
  choice: StreamChoice | undefined,
  usage: StreamChunk["usage"],
  state: StreamState,
  acc: ToolCallAccumulator,
  controller: StreamController,
): void {
  closeReasoning(state, controller)
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
    usage: buildUsage(usage),
    finishReason: mapFinishReason(choice?.finish_reason),
  })
}

type OpenAIToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } }

function mapToolChoice(
  toolChoice: LanguageModelV4CallOptions["toolChoice"],
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

type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: unknown }

function buildResponseFormat(
  responseFormat: LanguageModelV4CallOptions["responseFormat"],
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
  tools: LanguageModelV4CallOptions["tools"],
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

function buildRequestBody(
  modelId: string,
  options: LanguageModelV4CallOptions,
  settings: AnyRouterProviderSettings,
  stream: boolean,
  perCallOptions: AnyRouterChatProviderOptions,
  fileCache?: FileReferenceCache,
): Record<string, unknown> {
  const messages = convertToAnyRouterChatMessages(options.prompt, fileCache)
  const responseFormat = buildResponseFormat(options.responseFormat)
  const tools = buildTools(options.tools)
  const toolChoice = mapToolChoice(options.toolChoice)

  // Merge routing / session / extra from settings and per-call options
  const provider = perCallOptions.provider ?? settings.provider
  const sessionId = perCallOptions.sessionId ?? settings.sessionId
  const extraBody = { ...settings.extraBody, ...perCallOptions.extraBody }

  // Map the portable AI SDK 7 reasoning parameter to the gateway's reasoning_effort.
  const reasoningEffort = mapReasoningEffort(options.reasoning)

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
    reasoning_effort: reasoningEffort,
    ...extraBody,
  }

  // Strip undefined values
  for (const key of Object.keys(body)) {
    if (body[key] === undefined) delete body[key]
  }

  return body
}

/**
 * Translate the `cacheTtl` / `skipCache` settings + per-call
 * provider options into their Cloudflare AI Gateway header equivalents.
 * Per-call options take precedence over provider-level settings; each header
 * is omitted when its value is undefined (or `false` for `skipCache`).
 */
function buildCacheHeaders(
  settings: AnyRouterProviderSettings,
  perCallOptions: AnyRouterChatProviderOptions,
): Record<string, string> {
  const cacheTtl = perCallOptions.cacheTtl ?? settings.cacheTtl
  const skipCache = perCallOptions.skipCache ?? settings.skipCache

  const headers: Record<string, string> = {}
  if (cacheTtl !== undefined) headers["cf-aig-cache-ttl"] = String(cacheTtl)
  if (skipCache === true) headers["cf-aig-skip-cache"] = "true"
  return headers
}

export interface AnyRouterChatConfig {
  provider: string
  baseURL: string
  headers: () => Record<string, string | undefined>
  fetch?: typeof globalThis.fetch
  settings: AnyRouterProviderSettings
  /**
   * Shared file reference cache for the provider instance.
   * When present, `{ type: 'reference' }` file parts are resolved via the cache
   * rather than throwing `UnsupportedFunctionalityError`.
   */
  fileCache?: FileReferenceCache
}

export class AnyRouterChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4" as const
  readonly provider: string
  readonly modelId: string
  readonly supportedUrls: Record<string, RegExp[]> = {}

  private readonly config: AnyRouterChatConfig

  constructor(modelId: string, config: AnyRouterChatConfig) {
    this.modelId = modelId
    this.provider = config.provider
    this.config = config
  }

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
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
      this.config.fileCache,
    )

    const { value: response, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(
        this.config.headers(),
        buildCacheHeaders(this.config.settings, perCallOptions),
        options.headers,
      ),
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

    const content: LanguageModelV4GenerateResult["content"] = []

    if (message?.reasoning_content) {
      content.push({ type: "reasoning", text: message.reasoning_content })
    }

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

  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
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
      true,
      perCallOptions,
      this.config.fileCache,
    )

    const url = `${this.config.baseURL}/chat/completions`
    const { value: stream, responseHeaders } = await postJsonToApi({
      url,
      headers: combineHeaders(
        this.config.headers(),
        buildCacheHeaders(this.config.settings, perCallOptions),
        options.headers,
      ),
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
    const state: StreamState = {
      activeTextId: null,
      activeReasoningId: null,
      metadataEmitted: false,
    }
    const selfModelId = this.modelId

    // OpenAI-compatible backends with `stream_options.include_usage` send token
    // usage in a trailing chunk (`choices: []`) AFTER the finish_reason chunk.
    // Accumulate usage across all chunks and emit the `finish` part at flush —
    // emitting it on the finish_reason chunk loses the usage (it isn't there yet).
    let streamUsage: StreamChunk["usage"]
    let finishChoice: StreamChoice | undefined

    const transformStream = new TransformStream<
      ParseResult<z.infer<typeof streamChunkSchema>>,
      LanguageModelV4StreamPart
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
        if (chunk.error) {
          controller.enqueue(errorFramePart(chunk, { url, body, responseHeaders }))
          finishChoice = { finish_reason: "error" }
          return
        }
        const choice = chunk.choices?.[0]

        // Capture usage from whichever chunk carries it (often a trailing
        // choices:[] chunk); the finish part is emitted with it at flush.
        if (chunk.usage) streamUsage = chunk.usage

        emitResponseMetadata(chunk, state, selfModelId, controller)

        if (choice?.delta) emitDelta(choice.delta, state, toolCallAccumulator, controller)

        if (choice?.finish_reason) {
          finishChoice = choice
        }
      },

      flush(controller) {
        // Emit the single terminal finish part with the accumulated usage. This
        // also closes any open reasoning/text and flushes tool-calls.
        emitFinish(finishChoice, streamUsage, state, toolCallAccumulator, controller)
      },
    })

    return {
      stream: stream.pipeThrough(transformStream),
      request: { body },
      response: { headers: responseHeaders },
    }
  }
}
