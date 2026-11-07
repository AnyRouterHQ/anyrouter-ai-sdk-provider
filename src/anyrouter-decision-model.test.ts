import { describe, expect, it } from "vitest"
import { createAnyRouter } from "./anyrouter-provider"

function mockFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return async (_url, _init) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  }
}

describe("AnyRouterDecisionModel.doDecide()", () => {
  it("maps a choice answer with probabilities", async () => {
    let capturedBody: unknown
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string)
        return new Response(
          JSON.stringify({
            model: "jev-latest",
            answers: { department: { type: "choice", choice: "billing", probabilities: { billing: 0.9, support: 0.1 } } },
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      },
    })
    const result = await ar.decisionModel("typesafe/jev").doDecide({
      state: [{ type: "text", text: "I was charged twice." }],
      questions: {
        department: {
          type: "choice",
          instructions: "Which team should handle this?",
          criteria: { billing: "Charges and refunds", support: "Other requests" },
        },
      },
    })
    expect((capturedBody as Record<string, unknown>).model).toBe("typesafe/jev")
    expect((capturedBody as Record<string, unknown>).state).toBe("I was charged twice.")
    expect((capturedBody as Record<string, unknown>).questions).toEqual({
      department: {
        type: "choice",
        instructions: "Which team should handle this?",
        criteria: { billing: "Charges and refunds", support: "Other requests" },
      },
    })
    expect(result.answers.department).toEqual({
      type: "choice",
      choice: "billing",
      probabilities: { billing: 0.9, support: 0.1 },
    })
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 })
  })

  it("maps noul to a boolean probability", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockFetch({
        model: "jev-latest",
        answers: { refund: { type: "noul", noul: 0.92 } },
        usage: { input_tokens: 3, output_tokens: 2 },
      }),
    })
    const result = await ar.decisionModel("typesafe/jev").doDecide({
      state: [{ type: "text", text: "Please refund the extra charge." }],
      questions: {
        refund: { type: "boolean", instructions: "Is the customer asking for a refund?" },
      },
    })
    expect(result.answers.refund).toEqual({ type: "boolean", probability: 0.92 })
  })

  it("maps a score answer", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockFetch({
        model: "jev-latest",
        answers: { severity: { type: "score", score: 1.5 } },
        usage: {},
      }),
    })
    const result = await ar.decisionModel("typesafe/jev").doDecide({
      state: [{ type: "json", value: { message: "Site is down" } }],
      questions: {
        severity: {
          type: "score",
          instructions: "How severe is it?",
          criteria: ["Cosmetic", "Workaround exists", "Blocking; no workaround"],
        },
      },
    })
    expect(result.answers.severity).toEqual({ type: "score", score: 1.5 })
  })

  it("rejects box questions before any I/O", async () => {
    let called = false
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: async () => {
        called = true
        return new Response("{}", { status: 200 })
      },
    })
    // Box is excluded from supportedQuestionTypes, so Core throws before
    // doDecide runs. Direct calls are rejected by the same guard.
    await expect(
      ar
        .decisionModel("typesafe/jev")
        .doDecide({
          state: [{ type: "text", text: "x" }],
          // biome-ignore lint/suspicious/noExplicitAny: box is intentionally unsupported
          questions: { where: { type: "box", instructions: "Where is the damage?" } as any },
        }),
    ).rejects.toThrow()
    expect(called).toBe(false)
  })

  it("sends file state parts as gateway images", async () => {
    let capturedBody: unknown
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: async (_url, init) => {
        capturedBody = JSON.parse(init?.body as string)
        return new Response(
          JSON.stringify({ model: "jev-latest", answers: { damaged: { type: "noul", noul: 0.1 } }, usage: {} }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      },
    })
    await ar.decisionModel("typesafe/jev").doDecide({
      state: [
        { type: "text", text: "Inspect this package." },
        { type: "file", mediaType: "image/png", filename: "p.png", data: { type: "data", data: new Uint8Array([1, 2, 3]) } },
      ],
      questions: { damaged: { type: "boolean", instructions: "Is it damaged?" } },
    })
    const body = capturedBody as { images?: Array<{ mediaType: string; base64: string }>; state: unknown }
    expect(body.images).toEqual([{ mediaType: "image/png", base64: "AQID" }])
    expect(body.state).toBe("Inspect this package.")
  })

  it("throws APICallError on gateway error", async () => {
    const ar = createAnyRouter({
      apiKey: "test-test",
      fetch: mockFetch({ error: { code: "invalid_questions", message: "Bad questions" } }, 400),
    })
    await expect(
      ar.decisionModel("typesafe/jev").doDecide({
        state: [{ type: "text", text: "hi" }],
        questions: { q: { type: "boolean", instructions: "ok?" } },
      }),
    ).rejects.toThrow("Bad questions")
  })
})
