import { describe, expect, test, vi } from "vitest"
import { executeMemorySmartRead } from "../src/tools"

const now = new Date("2026-05-14T12:00:00.000Z")

function row(path: string, content: string, updatedAt = now) {
  return {
    id: `file_${path}`,
    physical_path: path,
    content_text: content,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
}

function createMockDb(rows: ReturnType<typeof row>[]) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("mx_access_log")) return { rows: [] }
      return { rows }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("executeMemorySmartRead", () => {
  test("includes all visible files under budget with virtual paths", async () => {
    const db = createMockDb([
      row("users/u1/profile.md", "# Profile\n- Quiet neighborhoods"),
      row("shared/index.md", "# Shared"),
      row("users/other/profile.md", "# Other"),
    ])

    const result = await executeMemorySmartRead(db, { maxChars: 10_000 }, { userId: "u1" })

    expect(result.filesIncluded).toEqual(["user/profile.md", "shared/index.md"])
    expect(result.filesOmitted).toEqual([])
    expect(result.truncated).toBe(false)
    expect(result.content).toContain("## user/profile.md")
    expect(result.content).toContain("## shared/index.md")
    expect(result.content).not.toContain("users/u1")
    expect(result.content).not.toContain("users/other")
  })

  test("omits files that do not fit the budget", async () => {
    const db = createMockDb([
      row("users/u1/a.md", "a".repeat(20)),
      row("users/u1/b.md", "b".repeat(20)),
    ])

    const result = await executeMemorySmartRead(db, { maxChars: 90 }, { userId: "u1" })

    expect(result.filesIncluded).toEqual(["user/a.md"])
    expect(result.filesOmitted).toEqual(["user/b.md"])
    expect(result.truncated).toBe(true)
  })

  test("uses BM25 SQL when query is provided", async () => {
    const db = createMockDb([row("users/u1/profile.md", "budget")])

    await executeMemorySmartRead(db, { query: "budget" }, { userId: "u1" })

    const [sql, values] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sql).toContain("plainto_tsquery")
    expect(sql).toContain("ts_rank_cd")
    expect(values).toEqual(["budget", "users/u1/%"])
  })
})
