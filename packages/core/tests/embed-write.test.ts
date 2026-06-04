import { describe, expect, test, vi } from "vitest"
import { executeMemoryPatch, executeMemoryWrite } from "../src/tools"
import { MemexError } from "../src/errors"
import type { EmbeddingAdapter } from "../src/search"

const updatedAt = new Date("2026-06-03T09:14:00.000Z")

function adapter(overrides: Partial<EmbeddingAdapter> = {}): EmbeddingAdapter {
  return {
    model: "mock-embedding",
    dimensions: 3,
    embed: vi.fn(async (input: string) => [input.length, 1, 0]),
    ...overrides,
  }
}

function createDb(input: { selectContent?: string } = {}) {
  const db = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id, physical_path")) {
        return {
          rows: [{
            id: "file_existing",
            physical_path: "users/u1/preferences.md",
            content_text: input.selectContent ?? "short memory",
            created_at: updatedAt,
            updated_at: updatedAt,
          }],
        }
      }
      if (sql.includes("INSERT INTO mx_file")) {
        return { rows: [{ id: "file_123", created: true }] }
      }
      return { rows: [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  }
  return db as unknown as import("../src/db").Db
}

function embeddingUpdateCall(db: import("../src/db").Db) {
  return (db.query as ReturnType<typeof vi.fn>).mock.calls.find(([sql]) => String(sql).includes("embedding = $2::vector"))
}

describe("embedding write lifecycle", () => {
  test("write stores embedding metadata with a mock adapter", async () => {
    const db = createDb()
    const embeddingAdapter = adapter()

    await executeMemoryWrite(db, { path: "user/preferences.md", content: "loves parks", reason: "test" }, { userId: "u1" }, {
      adapter: embeddingAdapter,
    })

    const call = embeddingUpdateCall(db)
    expect(call).toBeDefined()
    expect(call?.[1]?.slice(0, 6)).toEqual([
      "file_123",
      "[11,1,0]",
      "mock-embedding",
      3,
      "full",
      1,
    ])
    expect(String(call?.[1]?.[6])).toHaveLength(64)
  })

  test("patch recomputes hash and switches to mean_pooled when file grows", async () => {
    const db = createDb({ selectContent: "short memory" })
    const embeddingAdapter = adapter()
    const largeContent = "x".repeat(8_100)

    await executeMemoryPatch(db, {
      path: "user/preferences.md",
      operation: "replace_lines",
      match: "short memory",
      replacement: largeContent,
    }, { userId: "u1" }, { adapter: embeddingAdapter })

    const call = embeddingUpdateCall(db)
    expect(call?.[1]?.[4]).toBe("mean_pooled")
    expect(call?.[1]?.[5]).toBeGreaterThan(1)
    expect(String(call?.[1]?.[6])).toHaveLength(64)
  })

  test("no adapter leaves embedding columns untouched", async () => {
    const db = createDb()

    await executeMemoryWrite(db, { path: "user/preferences.md", content: "loves parks" }, { userId: "u1" })

    const sqlCalls = (db.query as ReturnType<typeof vi.fn>).mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes("embedding"))).toBe(false)
  })

  test("provider failure saves content and clears embedding metadata without throwing", async () => {
    const db = createDb()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const embeddingAdapter = adapter({
      embed: vi.fn(async () => {
        throw new Error("provider down")
      }),
    })

    await executeMemoryWrite(db, { path: "user/preferences.md", content: "loves parks" }, { userId: "u1" }, {
      adapter: embeddingAdapter,
    })

    const sqlCalls = (db.query as ReturnType<typeof vi.fn>).mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mx_file"))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes("embedding = NULL"))).toBe(true)
    warn.mockRestore()
  })

  test("dimension mismatch throws before writing content", async () => {
    const db = createDb()
    const embeddingAdapter = adapter({ embed: vi.fn(async () => [1, 2]) })

    await expect(executeMemoryWrite(
      db,
      { path: "user/preferences.md", content: "loves parks" },
      { userId: "u1" },
      { adapter: embeddingAdapter },
    )).rejects.toBeInstanceOf(MemexError)

    const sqlCalls = (db.query as ReturnType<typeof vi.fn>).mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mx_file"))).toBe(false)
  })

  test("mean_pooled files keep adapter dimensions and record chunk count", async () => {
    const db = createDb()
    const embeddingAdapter = adapter()

    await executeMemoryWrite(db, { path: "user/long.md", content: "x".repeat(8_500) }, { userId: "u1" }, {
      adapter: embeddingAdapter,
    })

    const call = embeddingUpdateCall(db)
    expect(call?.[1]?.[3]).toBe(3)
    expect(call?.[1]?.[4]).toBe("mean_pooled")
    expect(call?.[1]?.[5]).toBeGreaterThan(1)
  })
})
