# Hybrid Search with Reciprocal Rank Fusion

## Status: Planned

## Implementation Assumptions

Recorded before and during implementation on June 3, 2026:

- Slice commits are kept separate after their own focused build/test verification.
- Slice 1 is behavior-preserving for the public `memory_search` response: RRF helpers are introduced, but the agent tool schema and BM25 fallback shape do not change.
- Slice 2 uses a precomputed query embedding in core tests. Gemini/provider wiring is deferred to Slice 4, so core stays provider-agnostic.
- Vector migration is opt-in through `runMigrations(db, { vectorEnabled: true })`; BM25-only runs skip the pgvector migration and do not require the extension.
- The service migration runner mirrors the core skip behavior by skipping files whose names include `pgvector` unless `vectorEnabled` is true.
- MCP tool execution should receive the same embedding/search runtime as HTTP tool execution once service wiring lands.
- Admin file edits are considered writes for embedding lifecycle purposes unless implementation proves there is a product reason to keep them BM25-only.
- Admin UI search controls remain out of scope; only read-only deployment status and per-file embedding status are implemented.
- Existing direct-Postgres `createMemex()` users remain BM25-only in V1 unless an explicit future API wires embeddings into direct mode.

## Problem

`memory_search` uses pure BM25 (PostgreSQL `tsvector` + `ts_rank_cd`). BM25 is lexical — it only matches documents sharing tokens with the query. A query like "user prefers apartments near nature" will not match a memory that says "loves parks and green spaces" because no tokens overlap.

This forces agents to either:
- Issue multiple reformulated queries (more turns, higher latency, higher cost)
- Miss relevant memories entirely, producing lower-quality answers

The fix is to run BM25 and vector (dense semantic) search in parallel, then merge the two ranked lists using Reciprocal Rank Fusion. Both signals are kept — neither replaces the other.

## Experience Changes

Hybrid search should feel like a recall quality upgrade, not a new workflow operators or agents have to learn. The default agent experience remains `memory_search(query)`, but the system gets better at finding relevant memories even when the user and memory use different words.

### Agent experience

- Agents continue to call the same `memory_search` tool with the same arguments.
- Search results should explain why a memory matched: `lexical`, `semantic`, or `hybrid`.
- Result metadata should include enough scoring context for debugging without leaking implementation details into the prompt by default.
- When embeddings are unavailable, stale, or disabled, agents get normal BM25 results with no tool schema change.

Suggested internal result shape:

```ts
type SearchMatchReason = "lexical" | "semantic" | "hybrid";

type RankedResult = {
  path: string;
  content: string;
  score: number;
  rank: number;
  matchReason: SearchMatchReason;
  bm25Rank?: number;
  vectorRank?: number;
  bm25Score?: number;
  vectorDistance?: number;
  embeddingStatus?: "fresh" | "missing" | "stale" | "disabled";
};
```

Suggested agent-facing text plan:

```text
Search results:
- user/preferences.md (hybrid match): wants quiet apartments near green spaces
- user/visit-notes.md (semantic match): felt calm near parks, disliked dense traffic
- user/budget.md (lexical match): 2BHK budget and area constraints
```

The exact phrasing can stay compact; the important part is that agents can distinguish "keyword evidence" from "semantic evidence" when deciding how much to trust a result.

### End-user experience

End users should notice fewer "I forgot" or "I could not find that" failures:

- Natural paraphrases work: "near nature" can find "parks", "green spaces", and "tree-lined areas".
- Specific facts remain precise: "2BHK Whitefield budget" still returns the exact keyword-heavy memory first.
- Recall requires fewer retries, so interactive agents feel less repetitive.
- Personal memories remain scoped to `user/`; semantic search does not cross user boundaries.

### Admin experience

Embedding config is **env-locked** — search mode, provider, model, and dimensions are set at deployment time via environment variables and cannot be changed from the admin UI. No backfill: only files written after hybrid search is enabled receive embeddings. The admin UI provides read-only observability only.

Per-file embedding status in `Files` (read-only):

```text
File details
Path: users/user_123/preferences.md
Search index
- Lexical index: current
- Embedding: fresh
- Embedding model: text-embedding-004
- Strategy: full
- Embedded at: Jun 3, 2026 09:14
```

If the embedding column is absent (pgvector not available) or the adapter is not configured, the status row is omitted entirely — do not show a degraded or "disabled" badge inline on every file. Show a single deployment-level banner instead:

```text
[banner] Semantic search is not configured. Hybrid recall is disabled — set GEMINI_API_KEY and MEMEX_SEARCH_MODE=auto to enable.
```

No controls, no backfill triggers, no user-level search overrides.

### Persona-Level Impact

| Persona | Impact | Product concern |
|---|---|---|
| End user | More natural memory recall and fewer repeated clarifying questions | Semantic matches must not feel like hallucinated certainty |
| Agent developer | Same tool API, better retrieval quality, optional provider injection | Needs clear SDK options and fallback behaviour |
| Admin/operator | Can see embedding status per file (read-only); mode is env-locked | No controls to misconfigure at runtime |
| Compliance/security reviewer | Same user/shared path isolation; new provider may receive memory text | Needs provider, retention, and BM25-only mode documented |
| Support engineer | Can see embedding status and match reason per file | RRF ranks visible in per-file details |

## User Journeys

**Journey A - Semantic match that BM25 misses:**
1. Memory: "user loves being surrounded by trees and open space, finds urban density stressful"
2. Query: `memory_search("nature green space preferences")`
3. BM25: no keyword overlap, not returned
4. With hybrid RRF: vector search finds it in top 3
5. Agent answers in one turn and can cite the relevant memory

**Journey B - BM25 match preserved:**
1. Memory: "budget: 1.2Cr, 2BHK, Whitefield"
2. Query: `memory_search("2BHK Whitefield budget")`
3. BM25 still ranks it highly
4. RRF preserves the exact match as top 1 even if semantic neighbours also appear

**Journey C - Graceful fallback:**
1. `createMemex()` is called without an embedding adapter (or pgvector is missing)
2. `memory_search` runs BM25-only, identical to current behaviour
3. `embedding` stays `NULL` — no errors, no schema difference visible to agents
4. Admin file details omit the embedding status row; a deployment banner explains the mode

**Journey D - Provider outage:**
1. Embedding provider returns a transient error during write
2. Write succeeds and marks embedding as `missing`
3. Search continues with BM25 and any existing fresh embeddings for other files
4. Admin can see missing count in per-file details; no retry trigger needed — the next write to that file will re-attempt embedding

## Key Decisions

Decisions locked before implementation starts. Changing any of these after Slice 2 ships requires a data migration.

### Default provider: Gemini `text-embedding-004`

First provider to support. Dimensions: **768**. Auto-detected when `GEMINI_API_KEY` is set and `MEMEX_SEARCH_MODE` is `auto` or unset.

```bash
# compose.yml default — hybrid on if key is present, BM25-only otherwise
MEMEX_SEARCH_MODE=auto
GEMINI_API_KEY=${GEMINI_API_KEY:-}
```

V1 ships 768 dims (Gemini default). The vector column dimension is baked into the Postgres column type — changing providers later requires a migration that drops and recreates the column.

### Migration strategy

Switch the compose Postgres image from `postgres:16-alpine` to `pgvector/pgvector:pg16`.

The pgvector migration is **conditionally applied** based on whether `GEMINI_API_KEY` is set. The migration runner receives a `vectorEnabled` flag from startup config and skips any migration file matching `*pgvector*` when the flag is false.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Service startup                                                      │
│                                                                       │
│  GEMINI_API_KEY set?                                                  │
│  ┌────── yes ──────┐            ┌────── no ───────┐                  │
│  │ vectorEnabled=true           │ vectorEnabled=false                 │
│  │ runMigrations(db,            │ runMigrations(db,                   │
│  │   { vectorEnabled: true })   │   { vectorEnabled: false })         │
│  │                              │                                     │
│  │ migrations 001–006 ✓         │ migrations 001–006 ✓               │
│  │ 007_pgvector…sql  ✓  ←runs  │ 007_pgvector…sql  ✗  ←skipped     │
│  │                              │                                     │
│  │ embedding col EXISTS         │ embedding col DOES NOT EXIST        │
│  │ log: "search mode: hybrid"   │ log: "search mode: bm25"           │
│  └──────────────────┘           └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

Migration file `apps/service/migrations/007_pgvector_embeddings.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE mx_file
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_strategy TEXT,
  ADD COLUMN IF NOT EXISTS embedding_chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS mx_file_embedding_idx
  ON mx_file USING hnsw (embedding vector_cosine_ops);
```

Change to `apps/service/src/migrations.ts` — add `options` parameter and skip the pgvector file when `vectorEnabled` is false:

```ts
export async function runMigrations(
  db: Db,
  options: { vectorEnabled?: boolean } = {}
): Promise<void> {
  // ...existing mx_migration table creation...

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()

  for (const file of files) {
    if (!options.vectorEnabled && file.includes("pgvector")) continue  // ← skip

    const { rows } = await db.query("SELECT id FROM mx_migration WHERE id = $1", [file])
    if (rows.length > 0) continue

    // ...existing apply logic unchanged...
  }
}
```

Change to `apps/service/src/index.ts` — detect flag and pass it in:

```ts
const vectorEnabled = !!config.GEMINI_API_KEY
await runMigrations(db, { vectorEnabled })
console.error(`search mode: ${vectorEnabled ? "hybrid (gemini/text-embedding-004)" : "bm25"}`)
```

Same pattern applies to `packages/core/src/migrations.ts` — the pgvector migration entry in the `MIGRATIONS` array gets a `vectorOnly: true` marker and the runner skips it when `vectorEnabled` is false.

If `GEMINI_API_KEY` is set but pgvector is not installed, `CREATE EXTENSION IF NOT EXISTS vector` will fail, the migration throws, and startup aborts — fix the Postgres image. No silent fallback.

### Write lifecycle

Every `memory_write` and `memory_patch` follows this sequence when hybrid mode is active:

```
1. Write content to mx_file (transactional)
2. Compute content_hash = sha256(content_text)
3. Choose strategy: "full" if len ≤ MEMEX_EMBEDDING_MAX_CHARS (default 8000), else "mean_pooled"
4. Embed:
   - full: one provider call with full content_text
   - mean_pooled: N provider calls (2000-char chunks, 200-char overlap), mean-pool results
5. On success: UPDATE mx_file SET embedding=$vec, embedding_model=$model,
               embedding_dimensions=$dims, embedding_strategy=$strategy,
               embedding_chunk_count=$n, embedding_content_hash=$hash,
               embedding_updated_at=now()
6. On provider failure: log error, leave embedding NULL — do NOT roll back content write
```

The embed step is synchronous in the write request — write returns after embed succeeds or fails. Adds provider latency to writes; acceptable for V1.

**On patch**: embedding is computed from full post-patch `content_text`, not the delta. Same hash, same strategy decision.

**When BM25-only**: steps 2–6 are skipped entirely. The embedding columns are never touched.

#### Write path — with and without hybrid enabled

```
memory_write / memory_patch called
         │
         ▼
  ┌─────────────────────┐
  │  Write content_text  │  ← always, transactional
  │  to mx_file          │
  └─────────────────────┘
         │
         ▼
  vectorEnabled? (GEMINI_API_KEY set at startup)
         │
    ┌────┴────┐
   yes        no
    │          │
    ▼          ▼
compute      return ✓
content_hash  (done, no embedding columns touched)
    │
    ▼
len(content) ≤ 8000?
    │
  ┌─┴──┐
 yes    no
  │      │
  ▼      ▼
strategy  strategy = "mean_pooled"
= "full"  split into 2000-char chunks
  │       embed each chunk separately
  │       mean-pool → single vector
  │      │
  └──┬───┘
     ▼
  embed() → Gemini API
     │
  ┌──┴──┐
 ok    error
  │      │
  ▼      ▼
UPDATE   log error
mx_file  leave embedding = NULL
embedding do NOT roll back content write
cols set
  │
  ▼
return ✓
```

#### Search path — with and without hybrid enabled

```
memory_search(query, userId) called
         │
         ▼
  vectorEnabled?
         │
    ┌────┴────┐
   yes        no
    │          │
    ▼          ▼
embed(query)  bm25Search(query, userId)
→ queryVec         │
    │               ▼
    ▼           ranked results
bm25Search          │
vectorSearch        ▼
in parallel     return to agent
    │
    ▼
reciprocalRankFusion(bm25Results, vectorResults, k=60)
    │
    ▼
merged ranked results (matchReason: lexical | semantic | hybrid)
    │
    ▼
return to agent
```

### Chunking

The embedding column holds **one vector per file**. No multi-vector storage, no separate chunks table.

Two strategies depending on file size. The strategy used is recorded in `embedding_strategy` on `mx_file`.

**Strategy: `full`** (file ≤ `MEMEX_EMBEDDING_MAX_CHARS`, default 8000)
- Pass the full `content_text` to the provider.
- 8000 chars ≈ 2000 tokens, safe for Gemini `text-embedding-004` (2048 token limit).
- Applies to 95%+ of memory files in practice (individual memories, preferences, notes are typically 100–2000 chars).

**Strategy: `mean_pooled`** (file > `MEMEX_EMBEDDING_MAX_CHARS`)
- Split `content_text` into overlapping chunks: chunk size 2000 chars, overlap 200 chars (≈10%). This gives roughly 500-token chunks with a buffer against word splits.
- Embed each chunk separately (N provider calls).
- Compute mean of the N embedding vectors component-wise → one vector per file.
- Record `embedding_chunk_count = N` on `mx_file`.
- The mean-pooled vector represents the semantic "gist" of the whole file. This is appropriate for memory files where individual facts are scattered throughout (e.g. a dream-consolidated preferences file). It is not ideal for long-form documents but memory files are not long-form documents.

**Stale detection for mean_pooled files:**
- `embedding_content_hash` is computed from the full `content_text` (not per-chunk).
- Any content change → full hash changes → all chunks re-embedded on next write.
- Model or dimension change → `embedding_strategy` field and chunk count are preserved but the embedding is recomputed.

**Provider call budget per write:**
- `full`: 1 call.
- `mean_pooled`: ⌈(len - 2000) / 1800⌉ + 1 calls. A 20K char file requires ~11 calls. Acceptable for writes (not in hot path). Document the budget in SDK docs.

**No per-chunk storage.** The average vector is sufficient for the "which file is most relevant?" question. Per-chunk retrieval (return the specific paragraph that matched) is a V2 concern.

```ts
type EmbeddingStrategy = "full" | "mean_pooled";
```

Add `embedding_strategy TEXT` and `embedding_chunk_count INTEGER` to `mx_file` in the same migration that adds the `embedding` column.

## Proposed Design

### Search modes

Search mode should be explicit:

```ts
type SearchMode = "bm25" | "hybrid";
```

Default:
- `bm25` when no embedding adapter is configured
- `hybrid` when an embedding adapter is configured and the database supports vector search

Optional debug flags:

```ts
type SearchOptions = {
  mode?: SearchMode;
  limit?: number;
  debug?: boolean;
};
```

The public agent tool can keep its current schema in v1. SDK and admin diagnostics can expose `mode` and `debug`.

### New pgvector column on `mx_file`

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE mx_file
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_strategy TEXT,
  ADD COLUMN IF NOT EXISTS embedding_chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS mx_file_embedding_idx
  ON mx_file USING hnsw (embedding vector_cosine_ops);
```

Default dimension is **768** (Gemini `text-embedding-004`). The vector column type bakes in the dimension — changing it requires a new migration that drops and recreates the column. Document this clearly: switching providers means re-embedding all files and a schema migration.

Mirror this SQL in `apps/service/migrations/`.

### Embedding status

`embedding_content_hash` should be computed from the exact `content_text` used for embedding.

Status rules:
- `disabled`: no adapter configured or search mode is BM25-only
- `missing`: embedding is `NULL`
- `stale`: `embedding_content_hash` does not match current content hash, or model/dimension differs from current config
- `fresh`: embedding exists, model/dimension match, and hash matches current content

### EmbeddingAdapter interface (service-internal)

The service owns the embedding wiring. `EmbeddingAdapter` is an internal interface used inside `apps/service` to keep the Gemini call injectable and testable. It is **not** exposed as a public API in V1.

```ts
interface EmbeddingAdapter {
  model: string;
  dimensions: number;
  embed(input: string): Promise<number[]>;
}
```

The service instantiates a `GeminiEmbeddingAdapter` from env vars and passes it into core search functions. Direct-Postgres (`createMemex()`) support for the `EmbeddingAdapter` interface is a future item — see [Out of Scope](#out-of-scope).

Dimension mismatch should fail fast with a clear error before writing an incompatible vector.

### New module: `packages/core/src/search.ts`

- `bm25Search(db, userId, query, options): Promise<RankedResult[]>` - extracted from existing `memory_search` path
- `vectorSearch(db, userId, queryEmbedding, options): Promise<RankedResult[]>` - cosine distance via `<=>`, returns empty list if no fresh embeddings exist
- `reciprocalRankFusion(a, b, k = 60): RankedResult[]` - `score = 1/(k + rank_a) + 1/(k + rank_b)`, handles files present in only one list
- `hybridSearch(db, userId, query, options): Promise<RankedResult[]>` - orchestrates BM25, query embedding, vector search, and RRF
- `getEmbeddingStatus(file, config): EmbeddingStatus` - used by admin file details route

`memory_search` in `tools.ts` delegates to `hybridSearch`.

### Reciprocal Rank Fusion formula

```
score(doc) = 1/(60 + rank_in_bm25) + 1/(60 + rank_in_vector)
```

Documents absent from one list are treated as rank = ∞ (contributes 0 to that term). `k=60` is the standard default; makes the formula robust to very high-ranked outliers.

### Path and permission constraints

Hybrid search must preserve current virtual path behaviour:
- `user/` searches only the current user's physical namespace.
- `shared/` can be included as read-only global context if current search behaviour already includes it.
- Vector search must use the same physical path filters as BM25.
- Admin diagnostics can search across users only on admin routes with `x-admin-secret`.

### Service configuration

Environment variables:

```bash
# Search mode. Default: auto
# auto: hybrid if GEMINI_API_KEY is set and pgvector available, bm25 otherwise
MEMEX_SEARCH_MODE=auto # auto | bm25

# Gemini is the only built-in provider. Other providers are host-app responsibility.
GEMINI_API_KEY=...

# Tuning. Defaults shown.
MEMEX_RRF_K=60
MEMEX_BM25_CANDIDATE_LIMIT=50
MEMEX_VECTOR_CANDIDATE_LIMIT=50
MEMEX_EMBEDDING_MAX_CHARS=8000
```

`MEMEX_SEARCH_MODE=auto`: hybrid when `GEMINI_API_KEY` is set and pgvector available; BM25-only otherwise. `MEMEX_SEARCH_MODE=bm25` forces BM25 regardless.

The service should log the resolved search mode at startup.

**V1 scope: Docker service only.** Mode is determined entirely by env vars. The `EmbeddingAdapter` interface in `@memexai/core` is available for host-app direct-Postgres use cases, but service-side wiring (Gemini from env) is the only supported path in V1. `@memexai/sdk` passes through tool calls unchanged — no mode override in the SDK needed.

Agent tool schema stays stable. No user-level overrides.

## Edge Cases

| Edge case | Expected behaviour |
|---|---|
| No embedding adapter | BM25-only; no errors; embedding columns untouched |
| pgvector missing | Migration fails at startup; operator must fix Postgres setup — no silent fallback |
| Provider outage on write | Content write succeeds; `embedding = NULL`; no exception thrown to caller |
| Provider outage on query | Hybrid falls back to BM25 for that query; `matchReason` will only ever be `"lexical"` |
| Dimension mismatch | Fail fast with clear error before storing vector |
| Model changed in env | Existing embeddings become stale (hash still matches content but model differs); stale files return in BM25-only leg until rewritten |
| Empty or whitespace query | BM25 behaviour unchanged; do not call embedding provider |
| File ≤ 8000 chars | `strategy = "full"`, 1 provider call |
| File > 8000 chars | `strategy = "mean_pooled"`, N provider calls, same vector dimensions |
| Same file in both BM25 and vector results | One deduplicated result, `matchReason: "hybrid"` |
| File deleted mid-search | Consistent snapshot — deleted row not returned |
| Shared memory | Existing read-only semantics preserved; vector search uses same path filter as BM25 |
| Sensitive deployments | `MEMEX_SEARCH_MODE=bm25` — adapter never receives memory text |

## Task Split

### Slice 1 - Search module extraction and RRF

**Build:**
- Extract current BM25 logic from `tools.ts` into `packages/core/src/search.ts` as `bm25Search()`.
- Add `RankedResult` type with `matchReason: "lexical" | "semantic" | "hybrid"`, `bm25Rank?`, `vectorRank?` fields.
- Implement `reciprocalRankFusion(a, b, k=60): RankedResult[]` — handles files in only one list, deduplicates same path, deterministic tie-break (path asc).
- `memory_search` delegates to `bm25Search` (no behaviour change yet).

**Done when:**
- `bun test packages/core/tests/rrf.test.ts` passes: RRF score ordering correct, empty list handled, same-path deduplication works, ties deterministic.
- `bun test packages/core/tests/search.test.ts` passes: existing BM25 query results unchanged after extraction (regression gate).
- No changes to `memory_search` tool schema.

---

### Slice 2 - Migration and vector search

**Requires:** Slice 1 done. Run on a `pgvector/pgvector:pg16` instance.

**Build:**
- Add migration to `packages/core/src/migrations.ts`: `CREATE EXTENSION IF NOT EXISTS vector`, add `embedding vector(768)` and related columns (`embedding_model`, `embedding_dimensions`, `embedding_strategy`, `embedding_chunk_count`, `embedding_content_hash`, `embedding_updated_at`) to `mx_file`, add HNSW index.
- Mirror SQL in `apps/service/migrations/`.
- Implement `vectorSearch(db, userId, queryEmbedding, options): Promise<RankedResult[]>` — cosine distance via `<=>`, respects user path filter.
- Implement `hybridSearch()` that calls `bm25Search` + `vectorSearch` + `reciprocalRankFusion`. Returns BM25-only when no `queryEmbedding` is provided (fallback path).
- Add dimension validation: throw a clear error if stored `embedding_dimensions` ≠ configured dimensions before inserting a vector.

**Done when:**
- `bun test packages/core/tests/hybrid-search.test.ts` passes with a stub embed function:
  - Semantic-only match: pre-seeded embedding for "parks and nature" memory found by a synthetic "greenery" query vector that is not lexically related.
  - Keyword match: "2BHK Whitefield" still top 1 after RRF merge.
  - No embed adapter: `hybridSearch` falls back to BM25 results, no errors.
  - User isolation: user A query does not return user B paths.
- Migration is idempotent: running twice on the same DB does not error.

---

### Slice 3 - Embedding adapter and write path

**Requires:** Slice 2 migration applied.

**Build:**
- Add `EmbeddingAdapter` interface as an internal type in `packages/core/src/search.ts` (not yet a public `createMemex()` option — see Out of Scope).
- Wire embed call into `memory_write` and `memory_patch` inside core functions that accept an adapter argument (service passes the adapter in; core remains provider-agnostic).
- Implement chunking logic: `full` vs `mean_pooled` strategy based on `MEMEX_EMBEDDING_MAX_CHARS`.
- Mean-pool: split into 2000-char chunks with 200-char overlap, embed each, component-wise average.
- Store `embedding_strategy`, `embedding_chunk_count`, `embedding_content_hash`, `embedding_updated_at`.
- On provider failure: log, leave `embedding NULL`, do not roll back content write.
- Wire `hybridSearch` into `memory_search` when adapter is present.

**Done when:**
- `bun test packages/core/tests/embed-write.test.ts` passes:
  - Write with mock adapter: `embedding`, `embedding_model`, `embedding_strategy`, `embedding_content_hash` all set after write.
  - Patch: hash updates, strategy re-evaluated (a file that grew past 8000 chars switches from `full` to `mean_pooled`).
  - No adapter: `embedding IS NULL`, no errors.
  - Provider failure: content write succeeds, `embedding IS NULL`, no exception thrown to caller.
  - Dimension mismatch: clear error thrown before any write.
  - `mean_pooled` file (>8000 chars): `embedding_chunk_count > 1`, resulting vector has same dimensions as single-chunk files.
- End-to-end: `bun run demo:agent -- "I love parks and nature"` followed by `memory_search("greenery outdoor")` returns the written memory as a top result.

---

### Slice 4 - Service config and admin read-only status

**Requires:** Slice 3 done.

**Build:**
- Read env vars at service startup: `MEMEX_SEARCH_MODE`, `GEMINI_API_KEY`, `MEMEX_RRF_K`, `MEMEX_EMBEDDING_MAX_CHARS`.
- Instantiate a `GeminiEmbeddingAdapter` when the key is present and inject it into core search/write functions.
- Log resolved search mode at startup: `search mode: hybrid (gemini/text-embedding-004, 768 dims)` or `search mode: bm25 (no adapter configured)`.
- Add `GET /v1/admin/search/status` returning `{ mode, provider, model, dimensions }` — read-only, no controls.
- Add per-file embedding status fields to existing `GET /v1/admin/files/*` response: `embeddingStatus`, `embeddingStrategy`, `embeddingChunkCount`, `embeddingUpdatedAt`. Omit fields entirely when mode is BM25-only.
- Update `compose.yml`: add env var placeholders, switch Postgres image to `pgvector/pgvector:pg16`.

**Done when:**
- `bun test apps/service/tests/search-config.test.ts` passes:
  - `MEMEX_SEARCH_MODE=bm25`: no embedding adapter injected, no provider calls on write.
  - `MEMEX_SEARCH_MODE=auto` with `GEMINI_API_KEY` set: hybrid adapter injected, startup log shows hybrid.
  - `MEMEX_SEARCH_MODE=auto` with no key: BM25, startup log shows BM25.
  - `GET /v1/admin/search/status` returns correct mode and provider metadata.
  - `GET /v1/admin/files/:path` includes embedding fields when hybrid, omits them when BM25-only.

## Text and Prompt Plans

### Agent result phrasing

Keep result explanations short:

```text
Found 3 memories:
1. user/preferences.md - hybrid match
2. user/visit-may.md - semantic match
3. user/budget.md - lexical match
```

Avoid raw implementation language in normal prompts:
- Prefer `semantic match` over `embedding distance`.
- Prefer `keyword match` or `lexical match` over `ts_rank_cd`.
- Include raw ranks only in debug/admin surfaces.

### Admin empty states

```text
Semantic search is not configured.
Set GEMINI_API_KEY and restart the service to enable hybrid search. BM25 keyword search is still active.
```

```text
Embedding provider error.
Memory writes are still saved. New or changed files will use BM25 until the next write retries.
```

### Documentation copy

Docs should make the privacy boundary explicit:

```text
When hybrid search is enabled, memory content is sent to Gemini during writes and semantic queries. Set MEMEX_SEARCH_MODE=bm25 for deployments that cannot send memory text to an external provider.
```

## Success Criteria

| Criterion | Measurement |
|---|---|
| Semantic miss → hit | "greenery" query finds "parks and nature" memory with no shared tokens |
| No BM25 regression | Top-3 keyword query results unchanged after adding vector (Slice 1 regression test) |
| RRF beats either alone | 10-query eval harness: precision@3 for RRF ≥ max(BM25, vector) on ≥7/10 |
| No embed = no crash | Service without `GEMINI_API_KEY` runs BM25-only with no errors |
| Latency acceptable | `memory_search` p95 < 300ms with HNSW index and vector enabled |
| Provider failure is safe | Write succeeds and returns normally when embedding provider errors |
| Large file chunked correctly | File > 8000 chars gets `mean_pooled` strategy, same-dimension result vector |
| Mode locked to env | No runtime API or admin UI can change search mode — only env restart |

## Test Plan

Tests are mapped to slices so each slice can be verified independently before moving to the next.

**Slice 1 — `packages/core/tests/rrf.test.ts`**
- `rrf(rank=1, rank=1)` score > `rrf(rank=5, rank=5)` (higher rank = higher score)
- File in only one list: score equals single-term contribution (other term = 0)
- Same file in both lists: deduplicated, `matchReason: "hybrid"`
- Empty list inputs: no errors, returns items from the non-empty list
- Ties are stable: same output order on repeated calls (path asc tiebreak)

**Slice 1 — `packages/core/tests/search.test.ts` (BM25 regression)**
- Existing BM25 query results identical before and after extraction to `search.ts`

**Slice 2 — `packages/core/tests/hybrid-search.test.ts`** (requires pgvector)
- Semantic-only match: pre-seeded vector for "parks and nature" memory returned by a synthetic query vector close to "greenery outdoor", zero lexical overlap
- Keyword match: "2BHK Whitefield" still rank 1 after RRF
- Combined: file in both lists scores higher than file in only one
- No adapter: `hybridSearch` returns BM25 results unchanged, no errors
- User isolation: user A query vector never returns user B physical paths

**Slice 3 — `packages/core/tests/embed-write.test.ts`**
- Write with mock adapter: `embedding`, `embedding_model`, `embedding_strategy = "full"`, `embedding_content_hash` set
- File ≤ 8000 chars: strategy `"full"`, `embedding_chunk_count` is null or 1
- File > 8000 chars: strategy `"mean_pooled"`, `embedding_chunk_count > 1`, result vector has correct dimensions
- Patch on large file: content hash updates, strategy re-evaluated
- No adapter: `embedding IS NULL`, write succeeds
- Provider failure: content write succeeds, `embedding IS NULL`, no exception to caller
- Dimension mismatch: exception thrown with clear message before any write

**Slice 4 — `apps/service/tests/search-config.test.ts`**
- `MEMEX_SEARCH_MODE=bm25`: no provider calls on write, no embedding fields in file response
- `MEMEX_SEARCH_MODE=auto` with key present: hybrid adapter injected, startup log shows `search mode: hybrid`
- `MEMEX_SEARCH_MODE=auto` without key: BM25, startup log shows `search mode: bm25`
- `GET /v1/admin/search/status`: returns `{ mode, provider, model, dimensions }`
- `GET /v1/admin/files/:path` in hybrid mode: response includes `embeddingStatus`, `embeddingStrategy`, `embeddingChunkCount`
- `GET /v1/admin/files/:path` in BM25 mode: embedding fields absent from response

**Eval harness — `packages/core/tests/search-eval.ts`** (run manually, not in CI by default)
- 10 fixed query/memory pairs with known expected matches
- Assert precision@3 for BM25, vector, RRF separately
- Gate: RRF precision@3 ≥ max(BM25, vector) on ≥7/10 pairs

**Security**
- User A query never returns user B physical paths (covered in Slice 2 hybrid-search test)
- BM25-only mode makes zero provider calls on write or query (covered in Slice 4 config test)

## Out of Scope (V1)

These are explicitly deferred — not missing, just not part of this milestone:

- **`createMemex()` / direct-Postgres embedding support** — wiring `EmbeddingAdapter` into the core `createMemex()` API so containerless users can enable hybrid search without the service. Currently the embed adapter lives only inside `apps/service`. Add to ROADMAP when requested.
- **Non-Gemini providers** — the service ships one built-in adapter (Gemini). OpenAI, Cohere, local models, etc. are host-app responsibility until there is demand.
- **Backfill** — no mechanism to embed files that existed before hybrid search was enabled. Files only get embeddings on their next write.
- **Admin search controls** — mode is env-locked; no runtime toggle, no per-user override, no backfill trigger.
- **Per-chunk storage / passage retrieval** — one vector per file only; per-paragraph semantic retrieval is V2.
