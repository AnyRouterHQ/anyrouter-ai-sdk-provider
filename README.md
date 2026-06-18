# @anyr/ai-sdk-provider

The [AnyRouter](https://anyrouter.dev) provider for the [Vercel AI SDK](https://ai-sdk.dev).

Call every model on the AnyRouter gateway through the standard AI SDK
interface — `generateText`, `streamText`, `generateObject`, `embedMany`,
`generateImage` — with one key and one provider.

## Install

```bash
npm install @anyr/ai-sdk-provider ai zod
# or
pnpm add @anyr/ai-sdk-provider ai zod
```

## Quickstart

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { generateText } from "ai"

// Reads ANYROUTER_API_KEY from the environment when omitted.
const anyrouter = createAnyRouter()

const { text } = await generateText({
  model: anyrouter("openai/gpt-4o-mini"),
  prompt: "What is AnyRouter?",
})
console.log(text)
```

## Usage

### generateText

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { generateText } from "ai"

const anyrouter = createAnyRouter({ apiKey: process.env.ANYROUTER_API_KEY })

const { text } = await generateText({
  model: anyrouter("anthropic/claude-opus-4-5"),
  system: "You are a helpful assistant.",
  prompt: "Explain the butterfly effect in one paragraph.",
})
```

### streamText

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { streamText } from "ai"

const anyrouter = createAnyRouter()

const { textStream } = await streamText({
  model: anyrouter("openai/gpt-4o"),
  prompt: "Write a haiku about the ocean.",
})

for await (const chunk of textStream) {
  process.stdout.write(chunk)
}
```

### Reasoning models

Reasoning models (e.g. `deepseek/deepseek-r1`) return their thinking as a
separate stream — the provider surfaces it as the AI SDK's standard reasoning
parts, so `reasoning`/`reasoningText` and the full-stream `reasoning-*` parts
work out of the box.

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { generateText } from "ai"

const anyrouter = createAnyRouter()

const { text, reasoningText } = await generateText({
  model: anyrouter("deepseek/deepseek-r1"),
  prompt: "How many r's are in strawberry?",
})

console.log(reasoningText) // the model's chain of thought
console.log(text) // the final answer
```

### generateObject (structured output)

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { generateObject } from "ai"
import { z } from "zod"

const anyrouter = createAnyRouter()

const { object } = await generateObject({
  model: anyrouter("openai/gpt-4o-mini"),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
  }),
  prompt: "Summarise the latest AI news in a structured format.",
})

console.log(object.title, object.tags)
```

### Tool calling

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { generateText, tool } from "ai"
import { z } from "zod"

const anyrouter = createAnyRouter()

const { text, toolCalls } = await generateText({
  model: anyrouter("openai/gpt-4o"),
  tools: {
    get_weather: tool({
      description: "Get the current weather in a city.",
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ temperature: 22, unit: "C", city }),
    }),
  },
  prompt: "What is the weather in Tokyo?",
})
```

### Embeddings

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { embedMany } from "ai"

const anyrouter = createAnyRouter()

const { embeddings } = await embedMany({
  model: anyrouter.embeddingModel("openai/text-embedding-3-small"),
  values: ["Hello world", "How are you?"],
})

console.log(embeddings[0]) // [0.123, -0.456, ...]
```

### Image generation

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { generateImage } from "ai"

const anyrouter = createAnyRouter()

const { image } = await generateImage({
  model: anyrouter.imageModel("openai/dall-e-3"),
  prompt: "A serene mountain lake at dawn, oil painting.",
  size: "1024x1024",
})

// image.base64 — base64-encoded PNG or URL depending on the model
```

### Provider options (routing, session, extra body)

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"
import { generateText } from "ai"

// Set routing preferences at the provider level
const anyrouter = createAnyRouter({
  provider: { only: ["openai"], quantizations: ["bf16"] },
  sessionId: "user-session-abc",
})

// Or override them per-call
const { text } = await generateText({
  model: anyrouter("openai/gpt-4o"),
  prompt: "Hello!",
  experimental_providerMetadata: {
    anyrouter: {
      provider: { order: ["openai", "azure"] },
      sessionId: "per-request-session",
      extraBody: { logprobs: true },
    },
  },
})
```

## Configuration

```ts
import { createAnyRouter } from "@anyr/ai-sdk-provider"

const anyrouter = createAnyRouter({
  // API key — falls back to ANYROUTER_API_KEY env var (resolved lazily at request time)
  apiKey: "<your-anyrouter-key>",

  // API base URL — defaults to https://anyrouter.dev/api/v1
  baseURL: "https://anyrouter.dev/api/v1",

  // Extra headers merged into every request
  headers: { "X-Custom-Header": "value" },

  // Custom fetch implementation (e.g. for logging or proxying)
  fetch: myCustomFetch,

  // Default routing preference forwarded as `provider` in the request body
  provider: { only: ["openai"] },

  // Session ID forwarded as `session_id` — useful for grouping in analytics
  sessionId: "my-session",

  // Extra fields merged into every request body (per-call overrides these)
  extraBody: { safe_mode: true },
})
```

## Provider methods

| Method | Returns | Description |
|--------|---------|-------------|
| `anyrouter(modelId)` | `LanguageModelV3` | Shorthand for `anyrouter.chat(modelId)` |
| `anyrouter.chat(modelId)` | `LanguageModelV3` | Chat / instruction language model |
| `anyrouter.languageModel(modelId)` | `LanguageModelV3` | Alias for `.chat()` (ProviderV3 interface) |
| `anyrouter.embeddingModel(modelId)` | `EmbeddingModelV3` | Text embedding model |
| `anyrouter.imageModel(modelId)` | `ImageModelV3` | Image generation model |
| `anyrouter.client` | `AnyRouter` | Raw `@anyr/sdk` client (escape hatch) |

## Default export

```ts
import { anyrouter } from "@anyr/ai-sdk-provider"

// Uses ANYROUTER_API_KEY from the environment
const { text } = await generateText({
  model: anyrouter("openai/gpt-4o-mini"),
  prompt: "Hello!",
})
```

Built on [`@anyr/sdk`](https://www.npmjs.com/package/@anyr/sdk).

## License

MIT © Duyet Le
