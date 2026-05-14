import { describe, expect, test, vi } from "vitest"
import { Memex, MemexUser } from "../src/memex"
import { MemexError } from "../src/errors"
import { agenticToolDefinitions, rawToolDefinitions, toolDefinitions } from "../src/tool-definitions"

function createMockDb(overrides: Partial<{ query: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }> = {}) {
  return {
    query: vi.fn(async () => ({ rows: [] })),
    end: vi.fn(async () => {}),
    connect: vi.fn(async () => ({
      query: vi.fn(async () => ({ rows: [] })),
      release: vi.fn(),
    })),
    ...overrides,
  } as unknown as import("../src/db").Db
}

describe("Memex", () => {
  test("getTools() returns all tool definitions", () => {
    const memex = new Memex(createMockDb())
    const tools = memex.getTools()
    expect(tools).toHaveLength(7)
    expect(tools.map((t) => t.name)).toEqual(toolDefinitions.map((t) => t.name))
  })

  test("tool definitions are split into agentic and raw sets", () => {
    expect(agenticToolDefinitions.map((tool) => tool.name)).toEqual(["memory_memorize", "memory_search"])
    expect(rawToolDefinitions.map((tool) => tool.name)).toEqual([
      "memory_list",
      "memory_read",
      "memory_write",
      "memory_patch",
      "memory_smart_read",
    ])
  })

  test("getTools() returns MCP-compatible shape (name, description, inputSchema)", () => {
    const tools = new Memex(createMockDb()).getTools()
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string")
      expect(typeof tool.description).toBe("string")
      expect(typeof tool.inputSchema).toBe("object")
    }
  })

  test("forUser() creates a MemexUser scoped to that userId", () => {
    const memex = new Memex(createMockDb())
    const user = memex.forUser({ userId: "u1", actor: "agent" })
    expect(user).toBeInstanceOf(MemexUser)
  })

  test("executeTool() throws MemexError for unknown tool names", async () => {
    const memex = new Memex(createMockDb())
    await expect(
      memex.executeTool("memory_nonexistent", {}, { userId: "u1" }),
    ).rejects.toThrow(MemexError)
  })

  test("executeTool() routes memory_list correctly", async () => {
    const queryMock = vi.fn(async () => ({ rows: [] }))
    const memex = new Memex(createMockDb({ query: queryMock }))
    const result = await memex.executeTool("memory_list", {}, { userId: "user_123" })
    expect((result as { files: unknown[] }).files).toEqual([])
    expect(queryMock).toHaveBeenCalled()
  })

  test("executeTool() throws MemexError on bad path for memory_write", async () => {
    const memex = new Memex(createMockDb())
    await expect(
      memex.executeTool("memory_write", { path: "shared/file.md", content: "x" }, { userId: "u1" }),
    ).rejects.toThrow(MemexError)
  })

  test("end() closes the pool", async () => {
    const endMock = vi.fn(async () => {})
    const memex = new Memex(createMockDb({ end: endMock }))
    await memex.end()
    expect(endMock).toHaveBeenCalledOnce()
  })
})

describe("MemexUser", () => {
  test("list() delegates to memory_list", async () => {
    const queryMock = vi.fn(async () => ({ rows: [] }))
    const memex = new Memex(createMockDb({ query: queryMock }))
    const user = memex.forUser({ userId: "u1" })
    const result = await user.list()
    expect(result.files).toEqual([])
  })

  test("read() throws when file not found", async () => {
    const queryMock = vi.fn(async () => ({ rows: [] }))
    const memex = new Memex(createMockDb({ query: queryMock }))
    const user = memex.forUser({ userId: "u1" })
    await expect(user.read("user/missing.md")).rejects.toThrow(MemexError)
  })

  test("executeTool() forwards toolCallId in context", async () => {
    const queryMock = vi.fn(async () => ({ rows: [] }))
    const memex = new Memex(createMockDb({ query: queryMock }))
    const user = memex.forUser({ userId: "u1", actor: "agent" })
    await user.executeTool("memory_list", {}, "call_abc")
    const logCall = queryMock.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("mx_access_log"),
    )
    expect(logCall).toBeDefined()
    const logArgs = logCall?.[1] as unknown[]
    expect(logArgs).toContain("call_abc")
  })
})
