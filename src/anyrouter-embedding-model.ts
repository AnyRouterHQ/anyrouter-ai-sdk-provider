import type {
  EmbeddingModelV3,
  EmbeddingModelV3CallOptions,
  EmbeddingModelV3Result,
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

const embeddingResponseSchema = z.object({
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
})

export interface AnyRouterEmbeddingConfig {
  provider: string
  baseURL: string
  headers: () => Record<string, string | undefined>
  fetch?: typeof globalThis.fetch
}

export class AnyRouterEmbeddingModel implements EmbeddingModelV3 {
  readonly specificationVersion = "v3" as const
  readonly provider: string
  readonly modelId: string

  /** No hard per-call limit imposed by the provider layer. */
  readonly maxEmbeddingsPerCall: number | undefined = undefined
  readonly supportsParallelCalls = true

  private readonly config: AnyRouterEmbeddingConfig

  constructor(modelId: string, config: AnyRouterEmbeddingConfig) {
    this.modelId = modelId
    this.provider = config.provider
    this.config = config
  }

  async doEmbed(options: EmbeddingModelV3CallOptions): Promise<EmbeddingModelV3Result> {
    const { value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/embeddings`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body: {
        model: this.modelId,
        input: options.values,
      },
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: anyRouterErrorSchema,
        errorToMessage: (data) => data.error?.message ?? "AnyRouter embeddings API error",
        isRetryable: (response) => response.status >= 500,
      }),
      successfulResponseHandler: createJsonResponseHandler(embeddingResponseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const embeddings = response.data.map((d) => d.embedding)
    const tokens = response.usage?.prompt_tokens ?? response.usage?.total_tokens

    return {
      embeddings,
      usage: tokens !== undefined ? { tokens } : undefined,
      warnings: [],
    }
  }
}
