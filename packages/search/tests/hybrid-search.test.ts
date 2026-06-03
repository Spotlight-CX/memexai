import { describe, expect, test, vi } from "vitest"
import { hybridSearch, vectorSearch, type SearchScope } from "../src"

const updatedAt = new Date("2026-06-03T09:14:00.000Z")

type QueryCall = [string, unknown[] | undefined]

function createDb(input: {
  bm25Rows?: { physical_path: string; snippet: string; rank: number; updated_at: Date }[]
  vectorRows?: { physical_path: string; content_text: string; distance: number; updated_at: Date }[]
}) {
  const calls: QueryCall[] = []
  const db = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      calls.push([sql, values])
      if (sql.includes("<=>")) return { rows: input.vectorRows ?? [] }
      return { rows: input.bm25Rows ?? [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  }
  return { db, calls }
}

function scope(overrides: Partial<SearchScope> = {}): SearchScope {
  return {
    defaultUserLike: "users/u1/%",
    physicalToVirtual: (physicalPath) => {
      if (physicalPath.startsWith("users/u1/")) return `user/${physicalPath.slice("users/u1/".length)}`
      if (physicalPath.startsWith("shared/")) return physicalPath
      return null
    },
    ...overrides,
  }
}

describe("hybridSearch", () => {
  test("returns semantic-only matches when lexical search misses", async () => {
    const { db } = createDb({
      bm25Rows: [],
      vectorRows: [
        {
          physical_path: "users/u1/preferences.md",
          content_text: "loves parks and open spaces",
          distance: 0.04,
          updated_at: updatedAt,
        },
      ],
    })

    const results = await hybridSearch(db, {
      query: "greenery outdoor",
      queryEmbedding: [0.9, 0.1, 0.2],
      dimensions: 3,
      scope: scope(),
    })

    expect(results).toMatchObject([
      { path: "user/preferences.md", content: "loves parks and open spaces", matchReason: "semantic", vectorRank: 1 },
    ])
  })

  test("keeps exact keyword matches at the top after fusion", async () => {
    const { db } = createDb({
      bm25Rows: [
        { physical_path: "users/u1/budget.md", snippet: "2BHK Whitefield budget", rank: 0.9, updated_at: updatedAt },
        { physical_path: "users/u1/preferences.md", snippet: "apartment preference", rank: 0.2, updated_at: updatedAt },
      ],
      vectorRows: [
        { physical_path: "users/u1/preferences.md", content_text: "likes quiet homes", distance: 0.01, updated_at: updatedAt },
        { physical_path: "users/u1/budget.md", content_text: "budget: 1.2Cr, 2BHK, Whitefield", distance: 0.03, updated_at: updatedAt },
      ],
    })

    const results = await hybridSearch(db, {
      query: "2BHK Whitefield budget",
      queryEmbedding: [1, 0, 0],
      dimensions: 3,
      limit: 2,
      scope: scope(),
    })

    expect(results[0]).toMatchObject({ path: "user/budget.md", matchReason: "hybrid", bm25Rank: 1, vectorRank: 2 })
  })

  test("falls back to BM25 when no query embedding is provided", async () => {
    const { db, calls } = createDb({
      bm25Rows: [
        { physical_path: "users/u1/budget.md", snippet: "budget notes", rank: 0.7, updated_at: updatedAt },
      ],
    })

    const results = await hybridSearch(db, { query: "budget", limit: 5, scope: scope() })

    expect(results).toMatchObject([{ path: "user/budget.md", matchReason: "lexical" }])
    expect(calls.some(([sql]) => sql.includes("<=>"))).toBe(false)
  })

  test("vector search preserves user isolation and shared visibility", async () => {
    const { db, calls } = createDb({ vectorRows: [] })

    await vectorSearch(db, { queryEmbedding: [0.2, 0.3, 0.4], dimensions: 3, limit: 7, scope: scope() })

    const [sql, values] = calls[0]
    expect(sql).toContain("physical_path LIKE $2 OR physical_path LIKE 'shared/%'")
    expect(sql).toContain("embedding <=> $1::vector")
    expect(sql).toContain("embedding_dimensions = $3")
    expect(values).toEqual(["[0.2,0.3,0.4]", "users/u1/%", 3, 7])
  })

  test("filters vector search by virtual prefix", async () => {
    const { db, calls } = createDb({ vectorRows: [] })

    await vectorSearch(db, {
      queryEmbedding: [0.2, 0.3, 0.4],
      scope: scope({ prefixExact: "users/u1", prefixLike: "users/u1/%" }),
    })

    const [, values] = calls[0]
    expect(values).toEqual(["[0.2,0.3,0.4]", "users/u1", "users/u1/%", 10])
  })
})
