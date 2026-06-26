import type {
  ImageModelV4,
  ImageModelV4CallOptions,
  ImageModelV4Result,
  SharedV4Warning,
} from "@ai-sdk/provider"
import { UnsupportedFunctionalityError } from "@ai-sdk/provider"
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

const imageGenerationResponseSchema = z.object({
  created: z.number().optional(),
  data: z.array(
    z.object({
      url: z.string().optional(),
      b64_json: z.string().optional(),
      revised_prompt: z.string().optional(),
    }),
  ),
})

export interface AnyRouterImageConfig {
  provider: string
  baseURL: string
  headers: () => Record<string, string | undefined>
  fetch?: typeof globalThis.fetch
}

export class AnyRouterImageModel implements ImageModelV4 {
  readonly specificationVersion = "v4" as const
  readonly provider: string
  readonly modelId: string

  /**
   * Most image generation APIs support only 1 image per call via the
   * standard `/images/generations` endpoint.
   */
  readonly maxImagesPerCall = 1

  private readonly config: AnyRouterImageConfig

  constructor(modelId: string, config: AnyRouterImageConfig) {
    this.modelId = modelId
    this.provider = config.provider
    this.config = config
  }

  async doGenerate(options: ImageModelV4CallOptions): Promise<ImageModelV4Result> {
    // V4 image editing: throw on mask (inpainting) or files (editing/variation).
    if (options.mask) {
      throw new UnsupportedFunctionalityError({
        functionality: "mask (inpainting) for AnyRouter image generation",
      })
    }
    if (options.files && options.files.length > 0) {
      throw new UnsupportedFunctionalityError({
        functionality: "image editing (files) for AnyRouter image generation",
      })
    }

    const warnings: SharedV4Warning[] = []

    if (options.n > 1) {
      warnings.push({
        type: "unsupported",
        feature: `n=${options.n} (AnyRouter image endpoint supports n=1 per call)`,
      })
    }

    const body: Record<string, unknown> = {
      model: this.modelId,
      prompt: options.prompt ?? "",
      n: Math.min(options.n, 1),
      ...(options.size ? { size: options.size } : {}),
      ...(options.seed !== undefined ? { seed: options.seed } : {}),
      response_format: "b64_json",
    }

    const { value: response, responseHeaders } = await postJsonToApi({
      url: `${this.config.baseURL}/images/generations`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: createJsonErrorResponseHandler({
        errorSchema: anyRouterErrorSchema,
        errorToMessage: (data) => data.error?.message ?? "AnyRouter images API error",
        isRetryable: (res) => res.status >= 500,
      }),
      successfulResponseHandler: createJsonResponseHandler(imageGenerationResponseSchema),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    const images: string[] = []
    for (const item of response.data) {
      if (item.b64_json) {
        images.push(item.b64_json)
      } else if (item.url) {
        images.push(item.url)
      }
    }

    return {
      images,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
      },
    }
  }
}
