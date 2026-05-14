import { describe, expect, test, vi } from "vitest"

const generateTextMock = vi.fn()

vi.mock("ai", () => ({
  generateText: generateTextMock,
  jsonSchema: (schema: unknown) => schema,
  stepCountIs: (count: number) => ({ count }),
}))

const { executeMemorySearch } = await import("../src/tools")
const { MemexError } = await import("../src/errors")

const updatedAt = new Date("2026-05-14T12:00:00.000Z")

function fileRow(path: string, content: string) {
  return {
    id: `file_${path}`,
    physical_path: path,
    content_text: content,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
}

function createDb() {
  return {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("mx_access_log")) return { rows: [] }
      if (sql.includes("ts_headline")) {
        return {
          rows: [{
            physical_path: "users/u1/profile.md",
            snippet: "quiet neighborhood",
            rank: 0.4,
            updated_at: updatedAt,
          }],
        }
      }
      if (sql.includes("ORDER BY physical_path ASC")) {
        return {
          rows: [
            fileRow("users/u1/profile.md", "# Profile\n- Quiet neighborhoods"),
            fileRow("shared/index.md", "# Shared"),
          ],
        }
      }
      if (sql.includes("WHERE physical_path = $1")) {
        if (values?.[0] === "users/u1/profile.md") {
          return { rows: [fileRow("users/u1/profile.md", "# Profile\n- Quiet neighborhoods")] }
        }
        return { rows: [] }
      }
      return { rows: [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("agentic memory search", () => {
  test("uses a read-only resolver and returns answer with sources", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      expect(Object.keys(input.tools)).toEqual(["memory_read", "memory_smart_read"])
      await input.tools.memory_read.execute({ path: "user/profile.md" })
      return { text: "The user prefers quiet neighborhoods. Source: user/profile.md" }
    })

    const result = await executeMemorySearch(
      db,
      { query: "neighborhood", maxReads: 2 },
      { userId: "u1" },
      { model: { id: "mock-model" } },
    )

    expect(result.answer).toContain("quiet neighborhoods")
    expect(result.sources).toEqual(["user/profile.md"])
    expect(result.results[0]?.path).toBe("user/profile.md")
    const sqlCalls = (db.query as ReturnType<typeof vi.fn>).mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes("UPDATE mx_file"))).toBe(false)
    expect(sqlCalls.some((sql) => sql.includes("mx_revision"))).toBe(false)
  })

  test("rejects physical paths requested by the inner resolver", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_read.execute({ path: "users/u1/profile.md" })
      return { text: "bad" }
    })

    await expect(executeMemorySearch(
      db,
      { query: "neighborhood" },
      { userId: "u1" },
      { model: { id: "mock-model" } },
    )).rejects.toThrow(MemexError)
  })

  test("enforces maxReads", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_read.execute({ path: "user/profile.md" })
      await input.tools.memory_read.execute({ path: "user/profile.md" })
      return { text: "bad" }
    })

    await expect(executeMemorySearch(
      db,
      { query: "neighborhood", maxReads: 1 },
      { userId: "u1" },
      { model: { id: "mock-model" } },
    )).rejects.toMatchObject({ code: "MAX_READS_EXCEEDED" })
  })
})
