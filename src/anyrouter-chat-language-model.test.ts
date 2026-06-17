import type { LanguageModelV3CallOptions, LanguageModelV3StreamPart } from "@ai-sdk/provider"
import { describe, expect, it } from "vitest"
import { createAnyRouter } from "./anyrouter-provider"

// ─── Helpers ───────────────────────────────────────────────────────────────

function makePrompt(text: string): LanguageModelV3CallOptions["prompt"] {
  return [{ role: "user", content: [{ type: "text", text }] }]
}

function mockFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return async (_url, _init) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  }
}

function sseBody(chunks: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    },
  })
}

function mockSseFetch(chunks: unknown[]): typeof globalThis.fetch {
  return async (_url, _init) => {
    return new Response(sseBody(chunks), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })
  }
}

// ─── doGenerate ────────────────────────────────────────────────────────────

describe("AnyRouterChatLanguageModel.doGenerate()", () => {
  it("sends correct request body and maps text response", async () => {
    let capturedBody: unknown

    const fetchMock: typeof globalThis.fetch = async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string)
      return new Response(
        JSON.stringify({
          id: "gen-abc",
          model: "openai/gpt-4o-mini",
          choices: [
            {
              message: { content: "Hello world", tool_calls: undefined },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }

    const ar = createAnyRouter({ apiKey: "test-test", fetch: fetchMock })
    const model = ar("openai/gpt-4o-mini")

    const result = await model.doGenerate({
      prompt: makePrompt("Say hello"),
      temperature: 0.7,
      maxOutputTokens: 100,
    })

    // Request body shape
    expect((capturedBody as Record<string, unknown>).model).toBe("openai/gpt-4o-mini")
    expect((capturedBody as Record<string, unknown>).temperature).toBe(0.7)
    expect((capturedBody as Record<string, unknown>).max_tokens).toBe(100)

    // Response mapping
    expect(result.content).toHaveLength(1)
    expect(result.content[0]).toMatchObject({ type: "text", text: "Hello world" })
    expect(result.finishReason.unified).toBe("stop")
    expect(result.usage.inputTokens.total).toBe(10)
    expect(result.usage.outputTokens.total).toBe(5)
    expect(result.response?.id).toBe("gen-abc")
  })

  it("maps tool-call response", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockFetch({
        id: "gen-tc",
        model: "openai/gpt-4o",
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_123",
                  type: "function",
                  function: {
                    name: "get_weather",
                    arguments: '{"city":"Tokyo"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 8 },
      }),
    })

    const result = await ar("openai/gpt-4o").doGenerate({
      prompt: makePrompt("What is the weather in Tokyo?"),
      tools: [
        {
          type: "function",
          name: "get_weather",
          inputSchema: {
            type: "object",
            properties: { city: { type: "string" } },
          },
        },
      ],
    })

    const tc = result.content.find((c) => c.type === "tool-call")
    expect(tc).toBeDefined()
    expect((tc as { toolName: string }).toolName).toBe("get_weather")
    expect((tc as { toolCallId: string }).toolCallId).toBe("call_123")
    expect((tc as { input: string }).input).toBe('{"city":"Tokyo"}')
    expect(result.finishReason.unified).toBe("tool-calls")
  })

  it("throws APICallError on 401 with AnyRouter error envelope", async () => {
    const ar = createAnyRouter({
      apiKey: "test-bad",
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "authentication_error",
              message: "Invalid API key",
            },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
    })

    await expect(ar("openai/gpt-4o-mini").doGenerate({ prompt: makePrompt("hi") })).rejects.toThrow(
      "Invalid API key",
    )
  })

  it("passes provider and session_id from settings", async () => {
    let capturedBody: unknown

    const ar = createAnyRouter({
      apiKey: "test-test",
      provider: { only: ["openai"] },
      sessionId: "sess-xyz",
      fetch: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string)
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 5, completion_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      },
    })

    await ar("openai/gpt-4o-mini").doGenerate({ prompt: makePrompt("hi") })

    expect((capturedBody as Record<string, unknown>).provider).toEqual({ only: ["openai"] })
    expect((capturedBody as Record<string, unknown>).session_id).toBe("sess-xyz")
  })

  it("per-call providerOptions.anyrouter overrides settings", async () => {
    let capturedBody: unknown

    const ar = createAnyRouter({
      apiKey: "test-test",
      sessionId: "original",
      fetch: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string)
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 5, completion_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      },
    })

    await ar("openai/gpt-4o-mini").doGenerate({
      prompt: makePrompt("hi"),
      providerOptions: {
        anyrouter: { sessionId: "override" },
      },
    })

    expect((capturedBody as Record<string, unknown>).session_id).toBe("override")
  })

  it("sets stream=true in doStream request", async () => {
    let capturedBody: unknown

    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string)
        return new Response(sseBody([]), {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        })
      },
    })

    const { stream } = await ar("openai/gpt-4o-mini").doStream({
      prompt: makePrompt("hi"),
    })
    // drain stream
    const reader = stream.getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect((capturedBody as Record<string, unknown>).stream).toBe(true)
  })
})

// ─── doStream ─────────────────────────────────────────────────────────────

describe("AnyRouterChatLanguageModel.doStream()", () => {
  it("emits stream-start, text-start, text-delta, text-end, finish in order", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockSseFetch([
        {
          id: "gen-stream-1",
          model: "openai/gpt-4o-mini",
          choices: [{ delta: { content: "Hello" }, finish_reason: null }],
        },
        {
          choices: [{ delta: { content: " world" }, finish_reason: null }],
        },
        {
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 5, completion_tokens: 3 },
        },
      ]),
    })

    const { stream } = await ar("openai/gpt-4o-mini").doStream({
      prompt: makePrompt("hi"),
    })

    const parts: LanguageModelV3StreamPart[] = []
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }

    const types = parts.map((p) => p.type)
    expect(types).toContain("stream-start")
    expect(types).toContain("text-start")
    expect(types).toContain("text-delta")
    expect(types).toContain("text-end")
    expect(types).toContain("finish")

    // Order: stream-start before text-start, text-start before text-delta
    expect(types.indexOf("stream-start")).toBeLessThan(types.indexOf("text-start"))
    expect(types.indexOf("text-start")).toBeLessThan(types.indexOf("text-delta"))

    // Deltas contain the expected text
    const deltas = parts
      .filter(
        (p): p is Extract<LanguageModelV3StreamPart, { type: "text-delta" }> =>
          p.type === "text-delta",
      )
      .map((p) => p.delta)
    expect(deltas).toEqual(["Hello", " world"])

    // Finish carries usage
    const finish = parts.find(
      (p): p is Extract<LanguageModelV3StreamPart, { type: "finish" }> => p.type === "finish",
    )
    expect(finish?.usage.inputTokens.total).toBe(5)
    expect(finish?.usage.outputTokens.total).toBe(3)
    expect(finish?.finishReason.unified).toBe("stop")
  })

  it("emits tool-input-start, tool-input-delta, tool-input-end, tool-call for tool calls", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockSseFetch([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_abc",
                    type: "function",
                    function: { name: "search", arguments: "" },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                tool_calls: [{ index: 0, function: { arguments: '{"q":"ai"}' } }],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [{ delta: {}, finish_reason: "tool_calls" }],
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        },
      ]),
    })

    const { stream } = await ar("openai/gpt-4o-mini").doStream({
      prompt: makePrompt("search for ai"),
    })

    const parts: LanguageModelV3StreamPart[] = []
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }

    const types = parts.map((p) => p.type)
    expect(types).toContain("tool-input-start")
    expect(types).toContain("tool-input-delta")
    expect(types).toContain("tool-input-end")
    expect(types).toContain("tool-call")

    const toolCall = parts.find(
      (p): p is Extract<LanguageModelV3StreamPart, { type: "tool-call" }> => p.type === "tool-call",
    )
    expect(toolCall?.toolName).toBe("search")
    expect(toolCall?.toolCallId).toBe("call_abc")
    expect(toolCall?.input).toBe('{"q":"ai"}')

    const finish = parts.find(
      (p): p is Extract<LanguageModelV3StreamPart, { type: "finish" }> => p.type === "finish",
    )
    expect(finish?.finishReason.unified).toBe("tool-calls")
  })
})
