import { describe, expect, test, vi } from "vitest"
import { Memex } from "@memexai/core"
import { parseCliArgs, runLiveAgent, runLiveAgentDirect, runSmoke, runSmokeDirect } from "../src/index"

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
    expect(parseCliArgs(["--smoke"])).toEqual({ smoke: true, direct: false, prompt: undefined })
    expect(parseCliArgs(["Remember", "this"])).toEqual({ smoke: false, direct: false, prompt: "Remember this" })
    expect(parseCliArgs(["--smoke", "--direct"])).toEqual({ smoke: true, direct: true, prompt: undefined })
    expect(parseCliArgs(["--direct", "Remember", "this"])).toEqual({ smoke: false, direct: true, prompt: "Remember this" })
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

  test("live agent prefers Gemini when a Gemini key is present", async () => {
    const fetchMock = createFetchMock()
    const generate = vi.fn(async (_input: unknown) => ({ text: "Saved that preference." }))
    const googleModelFactory = vi.fn(() => "mock-google-model")
    const openaiModelFactory = vi.fn(() => "mock-openai-model")

    await runLiveAgent({
      prompt: "Remember quiet projects.",
      env: {
        MEMEX_URL: "http://localhost:8080",
        MEMEX_API_KEY: "dev-agent-key",
        GEMINI_API_KEY: "test-gemini-key",
        GEMINI_MODEL: "gemini-test",
      },
      fetchImpl: fetchMock as never,
      log: vi.fn(),
      generate: generate as never,
      modelFactory: openaiModelFactory as never,
      googleModelFactory: googleModelFactory as never,
    })

    expect(googleModelFactory).toHaveBeenCalledWith("gemini-test")
    expect(openaiModelFactory).not.toHaveBeenCalled()
    const generateInput = generate.mock.calls[0]?.[0] as {
      model: string
      prompt: string
      system: string
      tools: Record<string, { inputSchema: unknown }>
    }

    expect(generateInput).toMatchObject({
      model: "mock-google-model",
      prompt: "Remember quiet projects.",
    })
    expect(generateInput.system).toContain("<memexai_memory>")
    expect(generateInput.tools.memory_memorize.inputSchema).toBeDefined()
    expect(generateInput.tools.memory_search.inputSchema).toBeDefined()
  })

  test("live agent falls back to OpenAI when no Gemini key is present", async () => {
    const fetchMock = createFetchMock()
    const generate = vi.fn(async (_input: unknown) => ({ text: "Saved that preference." }))
    const modelFactory = vi.fn(() => "mock-openai-model")

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
  })
})

describe("demo agent CLI — direct mode (@memexai/core)", () => {
  function createMockMemexOverride(userId: string) {
    let storedContent = ""
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (typeof sql !== "string") return { rows: [] }
      if (sql.includes("mx_migration") || sql.includes("CREATE TABLE") || sql.includes("INSERT INTO mx_access_log") || sql.includes("INSERT INTO mx_revision")) {
        return { rows: [] }
      }
      if (sql.includes("mx_file") && sql.includes("INSERT")) {
        storedContent = (params as string[])[2] ?? ""
        return { rows: [{ id: "file_abc", created: true }] }
      }
      if (sql.includes("mx_file") && sql.includes("SELECT") && storedContent) {
        return { rows: [{ id: "file_abc", physical_path: `users/${userId}/demo-agent.md`, content_text: storedContent, created_at: new Date(), updated_at: new Date() }] }
      }
      return { rows: [] }
    })
    const client = { query, release: vi.fn() }
    const db = { query, end: vi.fn(async () => {}), connect: vi.fn(async () => client) } as never
    const memex = new Memex(db)
    const user = memex.forUser({ userId, actor: "demo-agent" })
    return { memex, userId, user }
  }

  test("runSmokeDirect writes and reads without HTTP service", async () => {
    const userId = "demo_user"
    const memexOverride = createMockMemexOverride(userId)
    const log = vi.fn()

    await runSmokeDirect({ log, memexOverride })

    expect(log).toHaveBeenCalledWith("MemexAI direct smoke check passed.")
    expect(log).toHaveBeenCalledWith(`User: ${userId}`)
  })

  test("runLiveAgentDirect uses core tools in generateText", async () => {
    const userId = "demo_user"
    const memexOverride = createMockMemexOverride(userId)
    const generate = vi.fn(async (_input: unknown) => ({ text: "Memory saved." }))
    const googleModelFactory = vi.fn(() => "mock-google-model")

    await runLiveAgentDirect({
      prompt: "Remember I like quiet neighborhoods.",
      env: {
        DATABASE_URL: "postgresql://test/test",
        MEMEX_DEMO_USER_ID: userId,
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "gemini-test",
      },
      log: vi.fn(),
      generate: generate as never,
      googleModelFactory: googleModelFactory as never,
      memexOverride,
    })

    expect(generate).toHaveBeenCalledOnce()
    const callInput = generate.mock.calls[0]?.[0] as { system: string; tools: Record<string, unknown>; prompt: string }
    expect(callInput.system).toContain("<memexai_memory>")
    expect(callInput.tools).toHaveProperty("memory_memorize")
    expect(callInput.tools).toHaveProperty("memory_search")
    expect(callInput.prompt).toContain("quiet neighborhoods")
  })
})
