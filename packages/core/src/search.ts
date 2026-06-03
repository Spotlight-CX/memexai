import type { Db } from "./db"
import { MemexError } from "./errors"
import { physicalToVirtual, prefixToPhysical, type ToolContext } from "./paths"

export type SearchMatchReason = "lexical" | "semantic" | "hybrid"

export type RankedResult = {
  path: string
  content?: string
  snippet?: string
  score: number
  rank: number
  matchReason: SearchMatchReason
  bm25Rank?: number
  vectorRank?: number
  bm25Score?: number
  vectorDistance?: number
  updatedAt?: Date
}

type SearchRow = {
  physical_path: string
  snippet: string
  rank: number
  updated_at: Date
}

export async function bm25Search(
  db: Db,
  input: { query: string; limit?: number; prefix?: string },
  ctx: ToolContext,
): Promise<RankedResult[]> {
  const { query, limit = 10, prefix } = input
  const values: unknown[] = [query]
  let visibilityWhere = "(physical_path LIKE $2 OR physical_path LIKE 'shared/%')"
  values.push(`users/${ctx.userId}/%`)

  if (prefix) {
    const physicalPrefix = prefixToPhysical(prefix, ctx)
    if (!physicalPrefix) throw new MemexError("INVALID_PATH", "prefix is required")
    visibilityWhere = "(physical_path = $2 OR physical_path LIKE $3)"
    values.length = 1
    values.push(physicalPrefix, `${physicalPrefix.endsWith("/") ? physicalPrefix : `${physicalPrefix}/`}%`)
  }
  values.push(limit)

  const { rows } = await db.query<SearchRow>(
    `
      WITH q AS (SELECT plainto_tsquery('english', $1) AS query)
      SELECT
        physical_path,
        ts_headline('english', content_text, q.query, 'MaxFragments=2, MinWords=4, MaxWords=24') AS snippet,
        ts_rank_cd(search_vector, q.query) AS rank,
        updated_at
      FROM mx_file, q
      WHERE ${visibilityWhere}
        AND search_vector @@ q.query
      ORDER BY rank DESC, updated_at DESC
      LIMIT $${values.length}
    `,
    values,
  )

  return rows.flatMap((row, index) => {
    const path = physicalToVirtual(row.physical_path, ctx)
    if (!path) return []
    const rank = index + 1
    const score = Number(row.rank)
    return [{
      path,
      snippet: row.snippet,
      score,
      rank,
      matchReason: "lexical" as const,
      bm25Rank: rank,
      bm25Score: score,
      updatedAt: row.updated_at,
    }]
  })
}

export function reciprocalRankFusion(
  lexicalResults: RankedResult[],
  semanticResults: RankedResult[],
  k = 60,
): RankedResult[] {
  const byPath = new Map<string, RankedResult & { score: number }>()

  const merge = (result: RankedResult, source: "lexical" | "semantic", index: number) => {
    const sourceRank = source === "lexical" ? result.bm25Rank ?? result.rank ?? index + 1 : result.vectorRank ?? result.rank ?? index + 1
    const existing = byPath.get(result.path)
    const rrfScore = 1 / (k + sourceRank)

    if (!existing) {
      byPath.set(result.path, {
        ...result,
        score: rrfScore,
        matchReason: source,
        bm25Rank: source === "lexical" ? sourceRank : result.bm25Rank,
        vectorRank: source === "semantic" ? sourceRank : result.vectorRank,
      })
      return
    }

    existing.score += rrfScore
    existing.matchReason = "hybrid"
    if (source === "lexical") {
      existing.bm25Rank = sourceRank
      existing.bm25Score = result.bm25Score ?? result.score
    } else {
      existing.vectorRank = sourceRank
      existing.vectorDistance = result.vectorDistance
    }
    if (!existing.snippet && result.snippet) existing.snippet = result.snippet
    if (!existing.content && result.content) existing.content = result.content
    if (!existing.updatedAt && result.updatedAt) existing.updatedAt = result.updatedAt
  }

  lexicalResults.forEach((result, index) => merge(result, "lexical", index))
  semanticResults.forEach((result, index) => merge(result, "semantic", index))

  return [...byPath.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.path.localeCompare(b.path)
    })
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }))
}
