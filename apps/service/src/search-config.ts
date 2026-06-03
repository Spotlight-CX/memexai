import type { EmbeddingAdapter, EmbeddingConfig } from "@memexai/core"
import type { Config } from "./config"

const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
const GEMINI_EMBEDDING_DIMENSIONS = 768

export type SearchStatus = {
  mode: "bm25" | "hybrid"
  provider: "gemini" | null
  model: string | null
  dimensions: number | null
}

export type SearchRuntime = SearchStatus & {
  vectorEnabled: boolean
  embedding?: EmbeddingConfig
  rrfK: number
  bm25CandidateLimit: number
  vectorCandidateLimit: number
}

export function createSearchRuntime(config: Config): SearchRuntime {
  const apiKey = config.GEMINI_API_KEY ?? config.GOOGLE_GENERATIVE_AI_API_KEY
  const hybrid = config.MEMEX_SEARCH_MODE === "auto" && Boolean(apiKey)

  if (!hybrid) {
    return {
      mode: "bm25",
      provider: null,
      model: null,
      dimensions: null,
      vectorEnabled: false,
      rrfK: config.MEMEX_RRF_K,
      bm25CandidateLimit: config.MEMEX_BM25_CANDIDATE_LIMIT,
      vectorCandidateLimit: config.MEMEX_VECTOR_CANDIDATE_LIMIT,
    }
  }

  return {
    mode: "hybrid",
    provider: "gemini",
    model: GEMINI_EMBEDDING_MODEL,
    dimensions: GEMINI_EMBEDDING_DIMENSIONS,
    vectorEnabled: true,
    embedding: {
      adapter: new GeminiEmbeddingAdapter(apiKey as string),
      maxChars: config.MEMEX_EMBEDDING_MAX_CHARS,
    },
    rrfK: config.MEMEX_RRF_K,
    bm25CandidateLimit: config.MEMEX_BM25_CANDIDATE_LIMIT,
    vectorCandidateLimit: config.MEMEX_VECTOR_CANDIDATE_LIMIT,
  }
}

export function searchStatus(runtime: SearchRuntime): SearchStatus {
  return {
    mode: runtime.mode,
    provider: runtime.provider,
    model: runtime.model,
    dimensions: runtime.dimensions,
  }
}

export class GeminiEmbeddingAdapter implements EmbeddingAdapter {
  readonly model = GEMINI_EMBEDDING_MODEL
  readonly dimensions = GEMINI_EMBEDDING_DIMENSIONS

  constructor(private readonly apiKey: string) {}

  async embed(input: string): Promise<number[]> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: `models/${this.model}`,
          content: {
            parts: [{ text: input }],
          },
          outputDimensionality: this.dimensions,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini embedding request failed: ${response.status} ${response.statusText}`)
    }

    const body = await response.json() as { embedding?: { values?: number[] } }
    const values = body.embedding?.values
    if (!Array.isArray(values)) {
      throw new Error("Gemini embedding response did not include embedding values")
    }
    return values
  }
}
