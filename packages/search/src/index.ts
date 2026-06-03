import { createHash } from "node:crypto"

export type SearchDb = {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>
}

export class SearchError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "SearchError"
  }
}

export type SearchScope = {
  defaultUserLike: string
  prefixExact?: string
  prefixLike?: string
  physicalToVirtual: (physicalPath: string) => string | null
}

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
  bm25CandidateLimit?: number
  vectorCandidateLimit?: number
  rrfK?: number
  dimensions?: number
  scope: SearchScope
}

export type EmbeddingStrategy = "full" | "mean_pooled"

export interface EmbeddingAdapter {
  model: string
  dimensions: number
  embed(input: string): Promise<number[]>
}

export type EmbeddingConfig = {
  adapter?: EmbeddingAdapter
  maxChars?: number
  chunkChars?: number
  chunkOverlap?: number
}

export type PreparedFileEmbedding =
  | {
    status: "ready"
    vector: number[]
    model: string
    dimensions: number
    strategy: EmbeddingStrategy
    chunkCount: number
    contentHash: string
  }
  | { status: "failed"; error: unknown }

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

function visibilityWhere(scope: SearchScope): { sql: string; values: unknown[] } {
  if (scope.prefixExact && scope.prefixLike) {
    return {
      sql: "(physical_path = $2 OR physical_path LIKE $3)",
      values: [scope.prefixExact, scope.prefixLike],
    }
  }

  return {
    sql: "(physical_path LIKE $2 OR physical_path LIKE 'shared/%')",
    values: [scope.defaultUserLike],
  }
}

export async function bm25Search(
  db: SearchDb,
  input: { query: string; limit?: number; scope: SearchScope },
): Promise<RankedResult[]> {
  const { query, limit = 10, scope } = input
  const visibility = visibilityWhere(scope)
  const values: unknown[] = [query, ...visibility.values, limit]

  const { rows } = await db.query<SearchRow>(
    `
      WITH q AS (SELECT plainto_tsquery('english', $1) AS query)
      SELECT
        physical_path,
        ts_headline('english', content_text, q.query, 'MaxFragments=2, MinWords=4, MaxWords=24') AS snippet,
        ts_rank_cd(search_vector, q.query) AS rank,
        updated_at
      FROM mx_file, q
      WHERE ${visibility.sql}
        AND search_vector @@ q.query
      ORDER BY rank DESC, updated_at DESC
      LIMIT $${values.length}
    `,
    values,
  )

  return rows.flatMap((row, index) => {
    const path = scope.physicalToVirtual(row.physical_path)
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

export function vectorLiteral(vector: number[]): string {
  if (vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
    throw new SearchError("INVALID_EMBEDDING", "Embedding vector must contain only finite numbers")
  }
  return `[${vector.join(",")}]`
}

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

export function chunkText(content: string, chunkChars = 2_000, overlap = 200): string[] {
  if (content.length <= chunkChars) return [content]
  const chunks: string[] = []
  const step = Math.max(1, chunkChars - overlap)
  for (let start = 0; start < content.length; start += step) {
    chunks.push(content.slice(start, start + chunkChars))
    if (start + chunkChars >= content.length) break
  }
  return chunks
}

function assertVectorDimensions(vector: number[], dimensions: number): void {
  if (vector.length !== dimensions) {
    throw new SearchError(
      "EMBEDDING_DIMENSION_MISMATCH",
      `Embedding dimension mismatch: expected ${dimensions}, received ${vector.length}`,
    )
  }
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new SearchError("INVALID_EMBEDDING", "Embedding vector must contain only finite numbers")
  }
}

function meanPool(vectors: number[][], dimensions: number): number[] {
  const sums = Array.from({ length: dimensions }, () => 0)
  for (const vector of vectors) {
    assertVectorDimensions(vector, dimensions)
    for (let index = 0; index < dimensions; index += 1) {
      sums[index] += vector[index] ?? 0
    }
  }
  return sums.map((sum) => sum / vectors.length)
}

export async function prepareFileEmbedding(content: string, config: EmbeddingConfig = {}): Promise<PreparedFileEmbedding | undefined> {
  const adapter = config.adapter
  if (!adapter) return undefined

  const maxChars = config.maxChars ?? 8_000
  const strategy: EmbeddingStrategy = content.length <= maxChars ? "full" : "mean_pooled"
  const chunks = strategy === "full" ? [content] : chunkText(content, config.chunkChars, config.chunkOverlap)

  try {
    const vectors: number[][] = []
    for (const chunk of chunks) {
      const vector = await adapter.embed(chunk)
      assertVectorDimensions(vector, adapter.dimensions)
      vectors.push(vector)
    }

    return {
      status: "ready",
      vector: strategy === "full" ? vectors[0] ?? [] : meanPool(vectors, adapter.dimensions),
      model: adapter.model,
      dimensions: adapter.dimensions,
      strategy,
      chunkCount: chunks.length,
      contentHash: contentHash(content),
    }
  } catch (error) {
    if (error instanceof SearchError && error.code === "EMBEDDING_DIMENSION_MISMATCH") throw error
    return { status: "failed", error }
  }
}

export async function storePreparedEmbedding(db: SearchDb, fileId: string, prepared: PreparedFileEmbedding | undefined): Promise<void> {
  if (!prepared) return
  if (prepared.status === "failed") {
    console.warn("MemexAI embedding provider failed; memory content was saved without an embedding", prepared.error)
    await db.query(
      `UPDATE mx_file
       SET embedding = NULL,
           embedding_model = NULL,
           embedding_dimensions = NULL,
           embedding_strategy = NULL,
           embedding_chunk_count = NULL,
           embedding_content_hash = NULL,
           embedding_updated_at = NULL
       WHERE id = $1`,
      [fileId],
    )
    return
  }

  await db.query(
    `UPDATE mx_file
     SET embedding = $2::vector,
         embedding_model = $3,
         embedding_dimensions = $4,
         embedding_strategy = $5,
         embedding_chunk_count = $6,
         embedding_content_hash = $7,
         embedding_updated_at = now()
     WHERE id = $1`,
    [
      fileId,
      vectorLiteral(prepared.vector),
      prepared.model,
      prepared.dimensions,
      prepared.strategy,
      prepared.chunkCount,
      prepared.contentHash,
    ],
  )
}

export async function vectorSearch(
  db: SearchDb,
  input: { queryEmbedding: number[]; limit?: number; dimensions?: number; scope: SearchScope },
): Promise<RankedResult[]> {
  const { queryEmbedding, limit = 10, dimensions, scope } = input
  if (dimensions !== undefined && queryEmbedding.length !== dimensions) {
    throw new SearchError(
      "EMBEDDING_DIMENSION_MISMATCH",
      `Embedding dimension mismatch: expected ${dimensions}, received ${queryEmbedding.length}`,
    )
  }

  const visibility = visibilityWhere(scope)
  const values: unknown[] = [vectorLiteral(queryEmbedding), ...visibility.values]
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
      WHERE ${visibility.sql}
        AND embedding IS NOT NULL
        ${dimensionWhere}
      ORDER BY embedding <=> $1::vector ASC, physical_path ASC
      LIMIT $${values.length}
    `,
    values,
  )

  return rows.flatMap((row, index) => {
    const path = scope.physicalToVirtual(row.physical_path)
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

export async function hybridSearch(db: SearchDb, input: HybridSearchOptions): Promise<RankedResult[]> {
  const limit = input.limit ?? 10
  if (!input.queryEmbedding) {
    return bm25Search(db, { query: input.query, limit, scope: input.scope })
  }

  const [lexicalResults, semanticResults] = await Promise.all([
    bm25Search(db, {
      query: input.query,
      limit: input.bm25CandidateLimit ?? Math.max(limit, 50),
      scope: input.scope,
    }),
    vectorSearch(db, {
      queryEmbedding: input.queryEmbedding,
      limit: input.vectorCandidateLimit ?? Math.max(limit, 50),
      dimensions: input.dimensions,
      scope: input.scope,
    }),
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
