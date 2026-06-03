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

export type HybridSearchOptions = {
  query: string
  queryEmbedding?: number[]
  limit?: number
  prefix?: string
  bm25CandidateLimit?: number
  vectorCandidateLimit?: number
  rrfK?: number
  dimensions?: number
}

type SearchRow = {
  physical_path: string
  snippet: string
  rank: number
  updated_at: Date
}

type VectorSearchRow = {
  physical_path: string
  content_text: string
  distance: number
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

function vectorLiteral(vector: number[]): string {
  if (vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
    throw new MemexError("INVALID_EMBEDDING", "Embedding vector must contain only finite numbers")
  }
  return `[${vector.join(",")}]`
}

export async function vectorSearch(
  db: Db,
  input: { queryEmbedding: number[]; limit?: number; prefix?: string; dimensions?: number },
  ctx: ToolContext,
): Promise<RankedResult[]> {
  const { queryEmbedding, limit = 10, prefix, dimensions } = input
  if (dimensions !== undefined && queryEmbedding.length !== dimensions) {
    throw new MemexError(
      "EMBEDDING_DIMENSION_MISMATCH",
      `Embedding dimension mismatch: expected ${dimensions}, received ${queryEmbedding.length}`,
    )
  }

  const values: unknown[] = [vectorLiteral(queryEmbedding)]
  let visibilityWhere = "(physical_path LIKE $2 OR physical_path LIKE 'shared/%')"
  values.push(`users/${ctx.userId}/%`)

  if (prefix) {
    const physicalPrefix = prefixToPhysical(prefix, ctx)
    if (!physicalPrefix) throw new MemexError("INVALID_PATH", "prefix is required")
    visibilityWhere = "(physical_path = $2 OR physical_path LIKE $3)"
    values.length = 1
    values.push(physicalPrefix, `${physicalPrefix.endsWith("/") ? physicalPrefix : `${physicalPrefix}/`}%`)
  }

  const dimensionWhere = dimensions === undefined ? "" : `AND embedding_dimensions = $${values.length + 1}`
  if (dimensions !== undefined) values.push(dimensions)
  values.push(limit)

  const { rows } = await db.query<VectorSearchRow>(
    `
      SELECT
        physical_path,
        content_text,
        embedding <=> $1::vector AS distance,
        updated_at
      FROM mx_file
      WHERE ${visibilityWhere}
        AND embedding IS NOT NULL
        ${dimensionWhere}
      ORDER BY embedding <=> $1::vector ASC, physical_path ASC
      LIMIT $${values.length}
    `,
    values,
  )

  return rows.flatMap((row, index) => {
    const path = physicalToVirtual(row.physical_path, ctx)
    if (!path) return []
    const rank = index + 1
    const distance = Number(row.distance)
    return [{
      path,
      content: row.content_text,
      score: 1 - distance,
      rank,
      matchReason: "semantic" as const,
      vectorRank: rank,
      vectorDistance: distance,
      updatedAt: row.updated_at,
    }]
  })
}

export async function hybridSearch(db: Db, input: HybridSearchOptions, ctx: ToolContext): Promise<RankedResult[]> {
  const limit = input.limit ?? 10
  if (!input.queryEmbedding) {
    return bm25Search(db, { query: input.query, limit, prefix: input.prefix }, ctx)
  }

  const [lexicalResults, semanticResults] = await Promise.all([
    bm25Search(db, { query: input.query, limit: input.bm25CandidateLimit ?? Math.max(limit, 50), prefix: input.prefix }, ctx),
    vectorSearch(db, {
      queryEmbedding: input.queryEmbedding,
      limit: input.vectorCandidateLimit ?? Math.max(limit, 50),
      prefix: input.prefix,
      dimensions: input.dimensions,
    }, ctx),
  ])

  return reciprocalRankFusion(lexicalResults, semanticResults, input.rrfK ?? 60).slice(0, limit)
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
