import type { Db } from "./db"
import { MemexError } from "./errors"
import { prefixToPhysical, physicalToVirtual, type ToolContext } from "./paths"
import {
  SearchError,
  bm25Search,
  hybridSearch,
  prepareFileEmbedding,
  type EmbeddingAdapter,
  type EmbeddingConfig,
  type RankedResult,
  type SearchScope,
} from "@memexai/search"
import { withObservationSpan } from "./observability"

export function searchScope(ctx: ToolContext, prefix?: string): SearchScope {
  if (!prefix) {
    return {
      defaultUserLike: `users/${ctx.userId}/%`,
      physicalToVirtual: (physicalPath) => physicalToVirtual(physicalPath, ctx),
    }
  }

  const physicalPrefix = prefixToPhysical(prefix, ctx)
  if (!physicalPrefix) throw new MemexError("INVALID_PATH", "prefix is required")
  return {
    defaultUserLike: `users/${ctx.userId}/%`,
    prefixExact: physicalPrefix,
    prefixLike: `${physicalPrefix.endsWith("/") ? physicalPrefix : `${physicalPrefix}/`}%`,
    physicalToVirtual: (physicalPath) => physicalToVirtual(physicalPath, ctx),
  }
}

export async function prepareCoreFileEmbedding(db: Db, content: string, options: EmbeddingConfig) {
  if (!options.adapter) return prepareFileEmbedding(content, options)
  return withObservationSpan(db, { name: "embedding", operation: "embedding" }, async () => {
    try {
      return await prepareFileEmbedding(content, options)
    } catch (error) {
      if (error instanceof SearchError) {
        throw new MemexError(error.code, error.message)
      }
      throw error
    }
  })
}

export async function rankMemoryCandidates(
  db: Db,
  query: string,
  scope: SearchScope,
  options: {
    adapter?: EmbeddingAdapter
    limit?: number
    bm25CandidateLimit?: number
    vectorCandidateLimit?: number
    rrfK?: number
  } = {}
): Promise<RankedResult[]> {
  if (options.adapter) {
    const preparedQueryEmbedding = await prepareCoreFileEmbedding(db, query, {
      adapter: options.adapter,
      maxChars: Number.MAX_SAFE_INTEGER,
    })
    const queryEmbedding = preparedQueryEmbedding?.status === "ready" ? preparedQueryEmbedding.vector : undefined

    return hybridSearch(db, {
      query,
      queryEmbedding,
      limit: options.limit,
      rrfK: options.rrfK,
      bm25CandidateLimit: options.bm25CandidateLimit,
      vectorCandidateLimit: options.vectorCandidateLimit,
      dimensions: options.adapter.dimensions,
      scope,
    })
  }

  return bm25Search(db, {
    query,
    limit: options.limit,
    scope,
  })
}
