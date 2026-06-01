# Hybrid Search with Reciprocal Rank Fusion

## Status: Planned

## Problem

`memory_search` uses pure BM25 (PostgreSQL `tsvector` + `ts_rank_cd`). BM25 is lexical — it only matches documents sharing tokens with the query. A query like "user prefers apartments near nature" will not match a memory that says "loves parks and green spaces" because no tokens overlap.

This forces agents to either:
- Issue multiple reformulated queries (more turns, higher latency, higher cost)
- Miss relevant memories entirely, producing lower-quality answers

The fix is to run BM25 and vector (dense semantic) search in parallel, then merge the two ranked lists using Reciprocal Rank Fusion. Both signals are kept — neither replaces the other.

## Proposed Design

### New pgvector column on `mx_file`

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE mx_file ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX mx_file_embedding_idx ON mx_file USING hnsw (embedding vector_cosine_ops);
```

Dimension (1536) is configurable at migration time to match the chosen embedding model.

### Embedding injection at `createMemex()`

```ts
interface MemexOptions {
  // ... existing options
  embed?: (text: string) => Promise<number[]>;
}
```

If `embed` is not provided, the system falls back to BM25-only. No hard dependency on any embedding provider.

### New module: `packages/core/src/search.ts`

- `bm25Search(db, userId, query, limit): Promise<RankedResult[]>` — extracted from existing `memory_search` path
- `vectorSearch(db, userId, embedding, limit): Promise<RankedResult[]>` — cosine similarity via `<=>`, returns empty list if no embeddings exist
- `reciprocalRankFusion(a, b, k = 60): RankedResult[]` — `score = 1/(k + rank_a) + 1/(k + rank_b)`, handles files present in only one list
- `hybridSearch(db, userId, query, embedFn?, limit): Promise<RankedResult[]>` — orchestrates all three

`memory_search` in `tools.ts` delegates to `hybridSearch`.

### Embedding on write

On every `memory_write` / `memory_patch`, if `embed` is configured, generate and store the embedding for `content_text`. Can be fire-and-forget (does not block the write response).

### Reciprocal Rank Fusion formula

```
score(doc) = 1/(60 + rank_in_bm25) + 1/(60 + rank_in_vector)
```

Documents absent from one list are treated as rank = ∞ (contributes 0 to that term). `k=60` is the standard default; makes the formula robust to very high-ranked outliers.

## User Journeys

**Journey A — Semantic match that BM25 misses:**
1. Memory: "user loves being surrounded by trees and open space, finds urban density stressful"
2. Query: `memory_search("nature green space preferences")`
3. BM25: no keyword overlap → not returned
4. With hybrid RRF: vector search finds it → top 3 → agent answers in one turn

**Journey B — BM25 match preserved (no regression):**
1. Memory: "budget: ₹1.2Cr, 2BHK, Whitefield"
2. Query: `memory_search("2BHK Whitefield budget")`
3. BM25 still wins → top 1, RRF confirms it

**Journey C — Graceful fallback (no embed function):**
1. `createMemex()` without `embed`
2. `memory_search` runs BM25-only, identical to current behaviour
3. `embedding` column stays NULL — no errors, no degradation

**Journey D — Backfill on upgrade:**
1. Existing deployment with 500 memories, `embed` newly configured
2. Background backfill job populates `embedding` for all rows where `embedding IS NULL`
3. Progress: `SELECT COUNT(*) FROM mx_file WHERE embedding IS NULL`
4. Once complete, RRF kicks in for all queries

## Success Criteria

| Criterion | Measurement |
|---|---|
| Semantic miss → hit | "greenery" query finds "parks and nature" memory with no shared tokens |
| No BM25 regression | Top-3 keyword query results unchanged or better after adding vector |
| RRF beats either alone | 10-query eval: precision@3 for RRF ≥ max(BM25, vector) on ≥7/10 |
| No embed = no crash | `createMemex()` without `embed` works exactly as today |
| Latency acceptable | `memory_search` p95 < 300ms with vector enabled (HNSW index required) |
| Backfill completable | 10K-file deployment fully backfilled within 10 minutes |

## Test Plan

**Unit tests** (`packages/core/tests/rrf.test.ts`):
- `reciprocalRankFusion(bm25, vector, k=60)` — deterministic, handles empty lists, deduplicates same path
- Higher rank = higher score: `rrf(rank=1, rank=1)` > `rrf(rank=5, rank=5)`
- File in only one list gets valid score (rank=∞ in absent list contributes 0)

**Integration tests** (`packages/core/tests/hybrid-search.test.ts`):
- Semantic-only match: "loves parks" memory found by "nature outdoor" query (BM25 would miss)
- Keyword match: "2BHK Whitefield" still top 1
- Combined: memory hitting both lists ranks above single-method matches
- No embed function: identical results to current BM25 path, no errors

**Embed injection tests** (`packages/core/tests/embed-option.test.ts`):
- Mock `embed` → verify write calls it, stores result in `embedding` column
- No `embed` → `embedding IS NULL` in DB

**Backfill tests** (`packages/core/tests/embed-backfill.test.ts`):
- 50 rows with `embedding = NULL`, run backfill → all populated
- Backfill idempotent: run twice, no duplicate embed calls for already-filled rows

**Eval harness** (`packages/core/tests/search-eval.ts`):
- 10 fixed query/memory pairs with known expected matches
- Assert precision@3 for BM25, vector, RRF separately
- RRF must match or beat max(BM25, vector) on ≥7/10 — regression gate for future changes
