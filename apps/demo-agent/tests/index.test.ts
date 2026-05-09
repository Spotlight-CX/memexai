import { describe, expect, test, vi } from "vitest"
import { parseCliArgs, runLiveAgent, runSmoke } from "../src/index"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  })
}

function createFetchMock() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url)

    if (href.endsWith("/v1/tools/memory_list/execute")) {
      return jsonResponse({ files: [] })
    }

    if (href.endsWith("/v1/tools/memory_write/execute")) {
      return jsonResponse({ path: "user/demo-agent.md", created: true, updated: false })
    }

    if (href.endsWith("/v1/tools/memory_read/execute")) {
      return jsonResponse({
        path: "user/demo-agent.md",
        content: "# Demo Agent",
        updatedAt: "2026-05-09T00:00:00.000Z",
      })
    }

    if (href.includes("/v1/prompt-block")) {
      return jsonResponse({ promptBlock: "<memexai_memory>\nNo files yet.\n</memexai_memory>" })
    }

    return jsonResponse({ init }, { status: 404 })
  })
}

describe("demo agent CLI", () => {
  test("parses smoke and prompt arguments", () => {
    expect(parseCliArgs(["--smoke"])).toEqual({ smoke: true, prompt: undefined })
    expect(parseCliArgs(["Remember", "this"])).toEqual({ smoke: false, prompt: "Remember this" })
  })

  test("smoke mode writes and reads demo memory without OpenAI", async () => {
    const fetchMock = createFetchMock()
    const log = vi.fn()

    const file = await runSmoke({
      env: {
        MEMEX_URL: "http://localhost:8080",
        MEMEX_API_KEY: "dev-agent-key",
        MEMEX_DEMO_USER_ID: "demo_user",
      },
      fetchImpl: fetchMock as never,
      log,
    })

    const writeCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/v1/tools/memory_write/execute"))
    expect(file.path).toBe("user/demo-agent.md")
    expect(writeCall).toBeDefined()
    expect(JSON.parse(String(writeCall?.[1]?.body))).toMatchObject({
      context: {
        userId: "demo_user",
        actor: "demo-agent",
        toolCallId: "demo-smoke-write",
      },
      arguments: {
        path: "user/demo-agent.md",
        reason: "Demo agent smoke check",
      },
    })
    expect(log).toHaveBeenCalledWith("MemexAI demo smoke check passed.")
  })

  test("smoke mode waits for the service to become ready", async () => {
    const fetchMock = createFetchMock()
    fetchMock.mockRejectedValueOnce(new Error("socket closed"))

    await runSmoke({
      env: {
        MEMEX_URL: "http://localhost:8080",
        MEMEX_API_KEY: "dev-agent-key",
      },
      fetchImpl: fetchMock as never,
      log: vi.fn(),
      retryDelayMs: 1,
    })

    const listCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/v1/tools/memory_list/execute"))
    expect(listCalls).toHaveLength(2)
  })

  test("live agent injects prompt block and Vercel tools without calling OpenAI in tests", async () => {
    const fetchMock = createFetchMock()
    const generate = vi.fn(async (_input: unknown) => ({ text: "Saved that preference." }))
    const modelFactory = vi.fn(() => "mock-model")

    await runLiveAgent({
      prompt: "Remember quiet projects.",
      env: {
        MEMEX_URL: "http://localhost:8080",
        MEMEX_API_KEY: "dev-agent-key",
        OPENAI_API_KEY: "test-openai-key",
        OPENAI_MODEL: "gpt-test",
      },
      fetchImpl: fetchMock as never,
      log: vi.fn(),
      generate: generate as never,
      modelFactory: modelFactory as never,
    })

    expect(modelFactory).toHaveBeenCalledWith("gpt-test")
    const generateInput = generate.mock.calls[0]?.[0] as {
      model: string
      prompt: string
      system: string
      tools: Record<string, { inputSchema: unknown }>
    }

    expect(generateInput).toMatchObject({
      model: "mock-model",
      prompt: "Remember quiet projects.",
    })
    expect(generateInput.system).toContain("<memexai_memory>")
    expect(generateInput.tools.memory_write.inputSchema).toBeDefined()
  })
})
