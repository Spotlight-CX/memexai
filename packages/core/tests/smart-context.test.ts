import { describe, expect, test, vi } from "vitest"
import { executeMemoryContext } from "../src/tools"

const now = new Date("2026-05-14T12:00:00.000Z")

function row(path: string, content: string, updatedAt = now, rank?: number) {
  return {
    id: `file_${path}`,
    physical_path: path,
    content_text: content,
    created_at: updatedAt,
    updated_at: updatedAt,
    ...(rank === undefined ? {} : { rank }),
  }
}

function createMockDb(rows: ReturnType<typeof row>[]) {
  return {
    query: vi.fn(async (sql: string, values: unknown[] = []) => {
      if (sql.includes("mx_access_log")) return { rows: [] }
      if (sql.includes("physical_path = ANY")) {
        const paths = values[0] as string[]
        return { rows: rows.filter((file) => paths.includes(file.physical_path)) }
      }
      if (sql.includes("search_vector @@ q.query")) {
        return { rows: rows.filter((file) => "rank" in file) }
      }
      return { rows }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

function createHybridMockDb(input: {
  rows: ReturnType<typeof row>[]
  vectorRows: { physical_path: string; content_text: string; distance: number; updated_at: Date }[]
}) {
  return {
    query: vi.fn(async (sql: string, values: unknown[] = []) => {
      if (sql.includes("mx_access_log")) return { rows: [] }
      if (sql.includes("embedding <=>")) return { rows: input.vectorRows }
      if (sql.includes("physical_path = ANY")) {
        const paths = values[0] as string[]
        return { rows: input.rows.filter((file) => paths.includes(file.physical_path)) }
      }
      if (sql.includes("search_vector @@ q.query")) {
        return { rows: input.rows.filter((file) => "rank" in file) }
      }
      return { rows: input.rows }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("executeMemoryContext", () => {
  test("includes all visible files under budget with virtual paths", async () => {
    const db = createMockDb([
      row("users/u1/profile.md", "# Profile\n- Quiet neighborhoods"),
      row("shared/index.md", "# Shared"),
      row("users/other/profile.md", "# Other"),
    ])

    const result = await executeMemoryContext(db, { maxChars: 10_000 }, { userId: "u1" })

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

    const result = await executeMemoryContext(db, { maxChars: 90 }, { userId: "u1" })

    expect(result.filesIncluded).toEqual(["user/a.md"])
    expect(result.filesOmitted).toEqual(["user/b.md"])
    expect(result.truncated).toBe(true)
  })

  test("uses BM25 SQL when query is provided", async () => {
    const db = createMockDb([row("users/u1/profile.md", "budget")])

    await executeMemoryContext(db, { query: "budget" }, { userId: "u1" })

    const [sql, values] = (db.query as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(sql).toContain("plainto_tsquery")
    expect(sql).toContain("ts_rank_cd")
    expect(values).toEqual(["budget", "users/u1/%"])
  })

  test("uses hybrid ranking for query smart reads when an embedding adapter is configured", async () => {
    const db = createHybridMockDb({
      rows: [
        row("users/u1/profile.md", "# Profile\n[[user/preferences.md]]"),
        row("users/u1/preferences.md", "# Preferences\n- Loves parks and green spaces"),
        row("users/other/profile.md", "# Other"),
      ],
      vectorRows: [
        {
          physical_path: "users/u1/profile.md",
          content_text: "# Profile\n[[user/preferences.md]]",
          distance: 0.1,
          updated_at: now,
        },
        {
          physical_path: "users/other/profile.md",
          content_text: "# Other",
          distance: 0.01,
          updated_at: now,
        },
      ],
    })

    const result = await executeMemoryContext(db, {
      query: "nature nearby",
      maxChars: 10_000,
    }, { userId: "u1" }, {
      adapter: {
        model: "mock-embedding",
        dimensions: 3,
        embed: vi.fn(async () => [1, 0, 0]),
      },
    })

    expect(result.filesIncluded).toEqual(["user/profile.md", "user/preferences.md"])
    expect(result.filesIncludedMeta).toEqual([
      { path: "user/profile.md", reason: "query_match", matchReason: "semantic", vectorRank: 1, depth: 0 },
      { path: "user/preferences.md", reason: "linked", linkedFrom: "user/profile.md", depth: 1 },
    ])
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls.some(([sql]) => String(sql).includes("embedding <=>"))).toBe(true)
    expect(result.content).not.toContain("users/other")
  })

  test("falls back to BM25 query seeds when embedding generation fails", async () => {
    const db = createHybridMockDb({
      rows: [row("users/u1/profile.md", "# Profile\n- Budget buyer", now, 0.8)],
      vectorRows: [],
    })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const result = await executeMemoryContext(db, {
      query: "budget",
      maxChars: 10_000,
    }, { userId: "u1" }, {
      adapter: {
        model: "mock-embedding",
        dimensions: 3,
        embed: vi.fn(async () => {
          throw new Error("provider down")
        }),
      },
    })

    expect(result.filesIncluded).toEqual(["user/profile.md"])
    expect(result.filesIncludedMeta).toEqual([
      { path: "user/profile.md", reason: "query_match", matchReason: "lexical", bm25Rank: 1, depth: 0 },
    ])
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls.some(([sql]) => String(sql).includes("embedding <=>"))).toBe(false)
    warn.mockRestore()
  })

  test("expands one-hop memory links for query smart reads", async () => {
    const db = createMockDb([
      row("users/u1/profile.md", "# Profile\n[[user/preferences.md]]\n[[shared/index.md]]", now, 0.8),
      row("users/u1/preferences.md", "# Preferences\n- Quiet"),
      row("shared/index.md", "# Shared"),
      row("users/u1/other.md", "# Other"),
    ])

    const result = await executeMemoryContext(db, { query: "quiet", maxChars: 10_000 }, { userId: "u1" })

    expect(result.filesIncluded).toEqual(["user/profile.md", "user/preferences.md", "shared/index.md"])
    expect(result.filesIncludedMeta).toEqual([
      { path: "user/profile.md", reason: "query_match", depth: 0 },
      { path: "user/preferences.md", reason: "linked", linkedFrom: "user/profile.md", depth: 1 },
      { path: "shared/index.md", reason: "linked", linkedFrom: "user/profile.md", depth: 1 },
    ])
  })

  test("does not expand links without query by default", async () => {
    const db = createMockDb([
      row("users/u1/profile.md", "# Profile\n[[user/preferences.md]]"),
    ])

    const result = await executeMemoryContext(db, { maxChars: 10_000 }, { userId: "u1" })

    expect(result.filesIncluded).toEqual(["user/profile.md"])
    expect((db.query as ReturnType<typeof vi.fn>).mock.calls.some(([sql]) => sql.includes("physical_path = ANY"))).toBe(false)
  })

  test("respects includeRelated false and relatedDepth zero", async () => {
    const rows = [
      row("users/u1/profile.md", "# Profile\n[[user/preferences.md]]", now, 0.8),
      row("users/u1/preferences.md", "# Preferences"),
    ]

    const disabled = await executeMemoryContext(createMockDb(rows), {
      query: "profile",
      includeRelated: false,
      maxChars: 10_000,
    }, { userId: "u1" })
    const depthZero = await executeMemoryContext(createMockDb(rows), {
      query: "profile",
      relatedDepth: 0,
      maxChars: 10_000,
    }, { userId: "u1" })

    expect(disabled.filesIncluded).toEqual(["user/profile.md"])
    expect(depthZero.filesIncluded).toEqual(["user/profile.md"])
  })

  test("handles circular links without duplicate inclusion", async () => {
    const db = createMockDb([
      row("users/u1/a.md", "# A\n[[user/b.md]]", now, 1),
      row("users/u1/b.md", "# B\n[[user/a.md]]\n[[user/c.md]]"),
      row("users/u1/c.md", "# C"),
    ])

    const result = await executeMemoryContext(db, {
      query: "alpha",
      relatedDepth: 2,
      maxChars: 10_000,
    }, { userId: "u1" })

    expect(result.filesIncluded).toEqual(["user/a.md", "user/b.md", "user/c.md"])
  })

  test("omits lower-priority linked files under budget pressure", async () => {
    const db = createMockDb([
      row("users/u1/a.md", "# A\n[[user/linked.md]]", now, 1),
      row("users/u1/b.md", "# B", now, 0.5),
      row("users/u1/linked.md", "x".repeat(50)),
    ])

    const result = await executeMemoryContext(db, { query: "alpha", maxChars: 180 }, { userId: "u1" })

    expect(result.filesIncluded).toEqual(["user/a.md", "user/b.md"])
    expect(result.filesOmitted).toEqual(["user/linked.md"])
  })
})
