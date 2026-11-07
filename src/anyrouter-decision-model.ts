import {
  APICallError,
  Experimental_DecisionUnsupportedQuestionTypeError as DecisionUnsupportedQuestionTypeError,
  type Experimental_DecisionModelV4 as DecisionModelV4,
  type Experimental_DecisionModelV4Answer as DecisionModelV4Answer,
  type Experimental_DecisionModelV4CallOptions as DecisionModelV4CallOptions,
  type Experimental_DecisionModelV4Question as DecisionModelV4Question,
  type Experimental_DecisionModelV4Result as DecisionModelV4Result,
  type Experimental_DecisionModelV4StatePart as DecisionModelV4StatePart,
  type SharedV4FileData,
  type SharedV4Headers,
} from "@ai-sdk/provider"
import {
  combineHeaders,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  postJsonToApi,
} from "@ai-sdk/provider-utils"
import { z } from "zod"

const anyRouterErrorSchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
})

const decisionResponseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(z.string(), z.unknown()),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
})

export interface AnyRouterDecisionConfig {
  provider: string
  baseURL: string
  headers: () => Record<string, string | undefined>
  fetch?: typeof globalThis.fetch
}

/**
 * Decision model for `experimental_decide` against the AnyRouter gateway.
 *
 * Maps Choice, Score, and Boolean questions to the gateway
 * `POST {baseURL}/decisions` endpoint (`noul` is gateway Boolean). Box questions
 * are not supported by the gateway, so they are left out of
 * `supportedQuestionTypes` and the Core rejects them before any I/O.
 */
export class AnyRouterDecisionModel implements DecisionModelV4 {
  readonly specificationVersion = "v4" as const
  readonly provider: string
  readonly modelId: string
  readonly supportedQuestionTypes = ["choice", "score", "boolean"] as const

  private readonly config: AnyRouterDecisionConfig

  constructor(modelId: string, config: AnyRouterDecisionConfig) {
    this.modelId = modelId
    this.provider = config.provider
    this.config = config
  }

  async doDecide(options: DecisionModelV4CallOptions): Promise<DecisionModelV4Result> {
    for (const [questionId, question] of Object.entries(options.questions)) {
      if (!this.supportedQuestionTypes.includes(question.type as "choice" | "score" | "boolean")) {
        throw new DecisionUnsupportedQuestionTypeError({
          questionId,
          provider: this.provider,
          modelId: this.modelId,
          questionType: question.type,
        })
      }
    }

    const { state, images } = await toGatewayState(options.state, this.config.fetch)
    const questions: Record<string, Record<string, unknown>> = {}
    for (const [id, question] of Object.entries(options.questions)) {
      questions[id] = toGatewayQuestion(question)
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      ...(state !== undefined ? { state } : {}),
      questions,
      ...(images.length > 0 ? { images } : {}),
    }

    const { value: response, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/decisions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: anyRouterErrorSchema,
        errorToMessage: (data) => data.error?.message ?? "AnyRouter decisions API error",
        isRetryable: (response) => response.status >= 500,
      }),
      successfulResponseHandler: createJsonResponseHandler(decisionResponseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const answers: Record<string, DecisionModelV4Answer> = {}
    for (const [id, raw] of Object.entries(response.answers)) {
      answers[id] = mapAnswer(id, raw)
    }

    return {
      answers,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
      warnings: [],
      response: response.model
        ? { modelId: response.model, headers: responseHeaders as SharedV4Headers }
        : undefined,
    }
  }
}

function toGatewayQuestion(question: DecisionModelV4Question): Record<string, unknown> {
  const instructions =
    question.instructions === null || question.instructions === undefined
      ? ""
      : question.instructions
  if (question.type === "choice") {
    return { type: "choice", instructions, criteria: question.criteria }
  }
  if (question.type === "score") {
    return { type: "score", instructions, criteria: question.criteria }
  }
  // Boolean maps to gateway `noul`. Boolean criteria (true/false descriptions)
  // have no gateway counterpart and are ignored here.
  return { type: "noul", instructions }
}

async function toGatewayState(
  state: readonly DecisionModelV4StatePart[],
  fetchFn?: typeof globalThis.fetch,
): Promise<{ state: unknown; images: Array<{ mediaType: string; base64: string }> }> {
  const images: Array<{ mediaType: string; base64: string }> = []
  const kept: unknown[] = []
  for (const part of state) {
    if (part.type === "file") {
      images.push(await toImage(part.data, part.mediaType, fetchFn))
    } else {
      kept.push(part)
    }
  }
  if (kept.length === 1 && (kept[0] as { type?: string }).type === "text") {
    return { state: (kept[0] as { text: string }).text, images }
  }
  if (kept.length === 1 && (kept[0] as { type?: string }).type === "json") {
    return { state: (kept[0] as { value: unknown }).value, images }
  }
  return { state: kept.length > 0 ? kept : undefined, images }
}

async function toImage(
  data: SharedV4FileData,
  mediaType: string,
  fetchFn?: typeof globalThis.fetch,
): Promise<{ mediaType: string; base64: string }> {
  if (data.type === "text") {
    return { mediaType, base64: encodeBase64(new TextEncoder().encode(data.text)) }
  }
  if (data.type === "reference") {
    throw new APICallError({
      message:
        "Decision file parts with type 'reference' are not supported. Pass bytes, base64, or a URL directly.",
      url: "", requestBodyValues: [],
    })
  }
  if (data.type === "url") {
    const response = await (fetchFn ?? globalThis.fetch)(data.url)
    if (!response.ok) {
      throw new APICallError({
        message: `Failed to download decision state file from ${data.url} (status ${response.status})`,
        url: data.url.toString(), requestBodyValues: [],
      })
    }
    return { mediaType, base64: encodeBase64(new Uint8Array(await response.arrayBuffer())) }
  }
  // { type: 'data', data }: bytes or base64 string.
  const raw = typeof data.data === "string" ? data.data : encodeBase64(data.data)
  return { mediaType, base64: raw }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function mapAnswer(id: string, raw: unknown): DecisionModelV4Answer {
  if (typeof raw !== "object" || raw === null) {
    throw new APICallError({ message: `Unexpected decision answer for question "${id}"`, url: "", requestBodyValues: [] })
  }
  const answer = raw as Record<string, unknown>
  if (answer.type === "refusal") return { type: "refusal" }
  if (answer.type === "choice") {
    const choice = answer.choice
    if (typeof choice !== "string") {
      throw new APICallError({ message: `Unexpected choice answer for question "${id}"`, url: "", requestBodyValues: [] })
    }
    return {
      type: "choice",
      choice,
      ...(isStringRecord(answer.probabilities) ? { probabilities: answer.probabilities } : {}),
    }
  }
  if (answer.type === "score") {
    const score = answer.score
    if (typeof score !== "number" || !Number.isFinite(score)) {
      throw new APICallError({ message: `Unexpected score answer for question "${id}"`, url: "", requestBodyValues: [] })
    }
    return {
      type: "score",
      score,
      ...(isStringRecord(answer.probabilities) ? { probabilities: answer.probabilities } : {}),
    }
  }
  // Gateway Boolean is `noul`: P(true) in [0, 1].
  const noul = answer.noul ?? answer.probability
  if (answer.type === "noul" || answer.type === "boolean") {
    if (typeof noul !== "number" || !Number.isFinite(noul)) {
      throw new APICallError({ message: `Unexpected boolean answer for question "${id}"`, url: "", requestBodyValues: [] })
    }
    return { type: "boolean", probability: noul }
  }
  throw new APICallError({ message: `Unknown decision answer type for question "${id}"`, url: "", requestBodyValues: [] })
}

function isStringRecord(value: unknown): value is Record<string, number> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
