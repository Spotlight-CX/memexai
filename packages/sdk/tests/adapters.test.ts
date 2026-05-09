import { describe, expect, test, vi } from "vitest"
import { MemexAI } from "../src"
import { createOpenAITools } from "../src/adapters/openai"
import { createVercelAITools } from "../src/adapters/vercel-ai"
import { createLangChainTools } from "../src/adapters/langchain"

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

    expect(tools.definitions.map((tool) => tool.name)).toContain("memory_read")

    await tools.execute({
      name: "memory_read",
      arguments: JSON.stringify({ path: "user/profile.md" }),
      toolCallId: "call_openai",
    })

    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_read/execute")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      context: { userId: "user_123", actor: "assistant", toolCallId: "call_openai" },
      arguments: { path: "user/profile.md" },
    })
  })

  test("Vercel AI adapter returns executable tool map", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: "user/profile.md", created: true, updated: false }))
    const tools = createVercelAITools(createMemory(fetchMock))

    expect(Object.keys(tools)).toContain("memory_write")
    await tools.memory_write.execute(
      { path: "user/profile.md", content: "# Profile" },
      { toolCallId: "call_vercel" },
    )

    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_write/execute")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).context.toolCallId).toBe("call_vercel")
  })

  test("LangChain adapter returns structured-tool-like objects", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ files: [] }))
    const tools = createLangChainTools(createMemory(fetchMock))
    const listTool = tools.find((tool) => tool.name === "memory_list")

    expect(listTool).toBeDefined()
    await listTool?.call({ prefix: "user/" }, { toolCallId: "call_langchain" })

    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_list/execute")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).context.toolCallId).toBe("call_langchain")
  })
})
