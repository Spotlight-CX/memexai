import { describe, expect, test, vi } from "vitest"
import { executeMemorySearch } from "../src/tools"

const updatedAt = new Date("2026-05-14T12:00:00.000Z")

function createDb(rows: { physical_path: string; snippet: string; rank: number; updated_at: Date }[]) {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("mx_access_log")) return { rows: [] }
      return { rows }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("executeMemorySearch", () => {
  test("returns BM25 matches with virtual paths", async () => {
    const db = createDb([
      { physical_path: "users/u1/profile.md", snippet: "quiet neighborhood", rank: 0.4, updated_at: updatedAt },
      { physical_path: "shared/index.md", snippet: "shared neighborhood guide", rank: 0.2, updated_at: updatedAt },
      { physical_path: "users/other/profile.md", snippet: "other user", rank: 0.9, updated_at: updatedAt },
    ])

    const result = await executeMemorySearch(db, { query: "neighborhood" }, { userId: "u1" })

    expect(result.query).toBe("neighborhood")
    expect(result.results.map((item) => item.path)).toEqual(["user/profile.md", "shared/index.md"])
    expect(result.truncated).toBe(false)
  })

  test("searches user and shared files by default", async () => {
    const db = createDb([])

    await executeMemorySearch(db, { query: "budget", limit: 3 }, { userId: "u1" })

    const [sql, values] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sql).toContain("physical_path LIKE $2 OR physical_path LIKE 'shared/%'")
    expect(sql).toContain("plainto_tsquery")
    expect(sql).toContain("ts_headline")
    expect(values).toEqual(["budget", "users/u1/%", 3])
  })

  test("supports user prefix filtering", async () => {
    const db = createDb([])

    await executeMemorySearch(db, { query: "budget", prefix: "user/" }, { userId: "u1" })

    const [sql, values] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sql).toContain("physical_path = $2 OR physical_path LIKE $3")
    expect(values).toEqual(["budget", "users/u1", "users/u1/%", 10])
  })

  test("supports shared prefix filtering", async () => {
    const db = createDb([])

    await executeMemorySearch(db, { query: "budget", prefix: "shared/" }, { userId: "u1" })

    const [, values] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(values).toEqual(["budget", "shared", "shared/%", 10])
  })
})
