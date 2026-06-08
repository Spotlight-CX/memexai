import { describe, expect, test, vi } from "vitest"
import { MemexAI } from "../src"
import { createOpenAITools } from "../src/adapters/openai"
import { createVercelAITools } from "../src/adapters/vercel-ai"
import { createLangChainTools } from "../src/adapters/langchain"
import { createAnthropicTools, handleAnthropicToolCall } from "../src/adapters/anthropic"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

function createMemory(fetchMock: ReturnType<typeof vi.fn>) {
  return new MemexAI({
    url: "http://memex.local",
    apiKey: "agent-key",
    fetch: fetchMock as never,
  }).forUser({ userId: "user_123", actor: "assistant" })
}

describe("tool adapters", () => {
  test("OpenAI adapter exposes definitions and executes through SDK", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: "user/profile.md", content: "# Profile" }))
    const tools = createOpenAITools(createMemory(fetchMock))

    expect(tools.definitions.map((tool) => tool.function.name)).toEqual(["memory_remember", "memory_context"])

    await tools.execute({
      name: "memory_remember",
      arguments: JSON.stringify({ text: "remember this" }),
      toolCallId: "call_openai",
    })

    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_remember/execute")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      context: { userId: "user_123", actor: "assistant", toolCallId: "call_openai" },
      arguments: { text: "remember this" },
    })
  })

  test("OpenAI adapter supports raw mode and parsed arguments", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: "user/profile.md", content: "# Profile" }))
    const tools = createOpenAITools(createMemory(fetchMock), { mode: "raw" })

    expect(tools.definitions.map((tool) => tool.function.name)).toEqual([
      "memory_list",
      "memory_read",
      "memory_write",
      "memory_patch",
      "memory_find",
    ])

    await tools.execute({
      name: "memory_read",
      arguments: { path: "user/profile.md" },
      toolCallId: "call_openai_raw",
    })

    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_read/execute")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).context.toolCallId).toBe("call_openai_raw")
  })

  test("Vercel AI adapter returns executable tool map", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ text: "Remembered.", dryRun: false, writes: [] }))
    const tools = createVercelAITools(createMemory(fetchMock))

    expect(Object.keys(tools)).toEqual(["memory_remember", "memory_context"])
    expect(tools.memory_remember.inputSchema).toBeDefined()
    await tools.memory_remember.execute(
      { text: "remember this" },
      { toolCallId: "call_vercel" },
    )

    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_remember/execute")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).context.toolCallId).toBe("call_vercel")
  })

  test("Vercel AI adapter can return raw tool map", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: "user/profile.md", created: true, updated: false }))
    const tools = createVercelAITools(createMemory(fetchMock), { mode: "raw" })

    expect(Object.keys(tools)).toEqual([
      "memory_list",
      "memory_read",
      "memory_write",
      "memory_patch",
      "memory_find",
    ])
    await tools.memory_write.execute(
      { path: "user/profile.md", content: "# Profile" },
      { toolCallId: "call_raw" },
    )
    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_write/execute")
  })

  test("Vercel AI adapter can return all tools", () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }))
    const tools = createVercelAITools(createMemory(fetchMock), { mode: "all" })

    expect(Object.keys(tools)).toEqual([
      "memory_remember",
      "memory_context",
      "memory_list",
      "memory_read",
      "memory_write",
      "memory_patch",
      "memory_find",
    ])
  })

  test("LangChain adapter defaults to memory subagent tools", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ files: [] }))
    const tools = createLangChainTools(createMemory(fetchMock))
    const rememberTool = tools.find((tool) => tool.name === "memory_remember")

    expect(tools.map((tool) => tool.name)).toEqual(["memory_remember", "memory_context"])
    await rememberTool?.call({ text: "remember this" }, { toolCallId: "call_langchain" })

    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_remember/execute")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).context.toolCallId).toBe("call_langchain")
  })

  test("LangChain adapter supports raw mode", () => {
    const fetchMock = vi.fn(async () => jsonResponse({ files: [] }))
    const tools = createLangChainTools(createMemory(fetchMock), { mode: "raw" })

    expect(tools.map((tool) => tool.name)).toEqual([
      "memory_list",
      "memory_read",
      "memory_write",
      "memory_patch",
      "memory_find",
    ])
  })

  test("Anthropic adapter exposes tools and executes through SDK", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ text: "Remembered.", dryRun: false, writes: [] }))
    const memory = createMemory(fetchMock)
    const tools = createAnthropicTools(memory)

    expect(tools.map((tool) => tool.name)).toEqual(["memory_remember", "memory_context"])
    expect(tools[0]?.input_schema).toBeDefined()

    await handleAnthropicToolCall(
      "memory_remember",
      { text: "remember this" },
      memory,
      "call_anthropic",
    )

    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_remember/execute")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).context.toolCallId).toBe("call_anthropic")
  })
})
