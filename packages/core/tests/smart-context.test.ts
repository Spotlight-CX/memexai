import { describe, expect, test, vi } from "vitest"

const generateTextMock = vi.fn()

vi.mock("ai", () => ({
  generateText: generateTextMock,
  jsonSchema: (schema: unknown) => schema,
  stepCountIs: (count: number) => ({ count }),
}))

const { executeMemoryContext } = await import("../src/tools")

function createDb() {
  return {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("mx_observation_event") || sql.includes("mx_access_log")) return { rows: [] }
      if (sql.includes("search_vector @@ q.query")) {
        return { rows: [{ id: "f1", physical_path: "users/u1/profile.md", content_text: "# Profile", created_at: new Date(), updated_at: new Date(), rank: 0.8 }] }
      }
      if (sql.includes("WHERE physical_path = $1")) {
        const path = values?.[0]
        if (path === "users/u1/profile.md") return { rows: [{ id: "f1", physical_path: "users/u1/profile.md", content_text: "# Profile", created_at: new Date(), updated_at: new Date() }] }
        return { rows: [] }
      }
      return { rows: [{ id: "f1", physical_path: "users/u1/profile.md", content_text: "# Profile", created_at: new Date(), updated_at: new Date() }] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("executeMemoryContext", () => {
  test("requires a configured model", async () => {
    await expect(executeMemoryContext(
      createDb(),
      {},
      { userId: "u1" },
    )).rejects.toMatchObject({ code: "MODEL_NOT_CONFIGURED" })
  })

  test("returns LLM text as context", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "You prefer quiet neighborhoods.", usage: null })

    const result = await executeMemoryContext(
      createDb(),
      { query: "preferences" },
      { userId: "u1" },
      { model: { id: "mock-model" } },
    )

    expect(result.context).toBe("You prefer quiet neighborhoods.")
    expect(result.filesRead).toEqual([])
  })

  test("exposes memory_find, memory_read, and memory_list tools to the inner LLM", async () => {
    generateTextMock.mockImplementationOnce(async (input: { tools: Record<string, unknown> }) => {
      expect(input.tools).toHaveProperty("memory_find")
      expect(input.tools).toHaveProperty("memory_read")
      expect(input.tools).toHaveProperty("memory_list")
      return { text: "done", usage: null }
    })

    await executeMemoryContext(createDb(), {}, { userId: "u1" }, { model: {} })
  })

  test("tracks files read by the inner LLM via memory_read", async () => {
    generateTextMock.mockImplementationOnce(async (input: { tools: Record<string, { execute: (a: unknown) => Promise<unknown> }> }) => {
      await input.tools.memory_read.execute({ path: "user/profile.md" })
      return { text: "Profile read.", usage: null }
    })

    const result = await executeMemoryContext(
      createDb(),
      { query: "profile" },
      { userId: "u1" },
      { model: {} },
    )

    expect(result.filesRead).toEqual(["user/profile.md"])
    expect(result.context).toBe("Profile read.")
  })

  test("inner LLM can call memory_find which runs BM25 search", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input: { tools: Record<string, { execute: (a: unknown) => Promise<unknown> }> }) => {
      const found = await input.tools.memory_find.execute({ query: "quiet" }) as { results: unknown[] }
      expect(found.results).toBeDefined()
      return { text: "Found.", usage: null }
    })

    await executeMemoryContext(db, { query: "quiet" }, { userId: "u1" }, { model: {} })

    expect((db.query as ReturnType<typeof vi.fn>).mock.calls.some(([sql]: [string]) => String(sql).includes("search_vector @@ q.query"))).toBe(true)
  })

  test("inner LLM can call memory_list to discover files", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input: { tools: Record<string, { execute: (a: unknown) => Promise<unknown> }> }) => {
      const listed = await input.tools.memory_list.execute({}) as { files: unknown[] }
      expect(Array.isArray(listed.files)).toBe(true)
      return { text: "Listed.", usage: null }
    })

    await executeMemoryContext(db, {}, { userId: "u1" }, { model: {} })
  })

  test("enforces read budget via MAX_READS_EXCEEDED", async () => {
    generateTextMock.mockImplementationOnce(async (input: { tools: Record<string, { execute: (a: unknown) => Promise<unknown> }> }) => {
      for (let i = 0; i < 12; i++) {
        await input.tools.memory_read.execute({ path: "user/profile.md" }).catch(() => {})
      }
      return { text: "tried", usage: null }
    })

    const result = await executeMemoryContext(createDb(), {}, { userId: "u1" }, { model: {} })
    expect(result.filesRead.length).toBeLessThanOrEqual(10)
  })

  test("includes the query in the LLM prompt", async () => {
    generateTextMock.mockImplementationOnce(async (input: { prompt: string }) => {
      expect(input.prompt).toContain("quiet neighborhoods")
      return { text: "done", usage: null }
    })

    await executeMemoryContext(createDb(), { query: "quiet neighborhoods" }, { userId: "u1" }, { model: {} })
  })
})
