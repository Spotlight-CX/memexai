# Bidirectional Backlink Index with Hub Scoring

## Status: Planned

## Problem

`memory_smart_read` traversal is forward-only. Starting from a BM25-seeded file, it follows memory links the file *points to* (depth 0 → 1 → 2), correctly avoids circular loops, and assembles everything into one response.

The gap is **backward traversal**. Hub files like `user/preferences.md` are referenced by many specific, recent files — visit notes, chat summaries, correction logs. Those inbound files are the most current evidence *about* the hub concept, but the current implementation never discovers them.

Example:
- Query: "what apartments suit this user?"
- BM25 seeds `user/preferences.md` ✓
- Traverses its outbound links → generic city/area notes
- **Misses** `user/visit-jan15.md` ("[[preferences.md]] confirmed 2BHK again") and `user/chat-may30.md` ("user updated budget [[preferences.md]]")

With reverse traversal, those inbound files join the same one-response context: fewer agentic turns, richer evidence window, more current context.

## Proposed Design

### New table: `mx_backlink`

```sql
CREATE TABLE mx_backlink (
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  PRIMARY KEY (source_path, target_path)
);
CREATE INDEX mx_backlink_target_idx ON mx_backlink (target_path);
```

### New column: `importance_score` on `mx_file`

```sql
ALTER TABLE mx_file ADD COLUMN IF NOT EXISTS importance_score REAL DEFAULT 0;
```

Updated on every write: `importance_score = (SELECT COUNT(*) FROM mx_backlink WHERE target_path = $1)`.

### New module: `packages/core/src/backlinks.ts`

- `extractMemoryLinks(content: string): string[]` — parses memory-link `[[path]]` syntax, deduplicates
- `syncBacklinks(db: Pool, sourcePath: string, content: string): Promise<void>` — upserts new links, deletes stale ones, updates `importance_score` on affected targets
- `getInboundLinks(db: Pool, targetPath: string): Promise<string[]>` — reverse lookup

### Changes to `memory_smart_read` (`packages/core/src/tools.ts`)

For each seed file in the initial BM25/recency set, also call `getInboundLinks` to fetch files pointing to it. Include them in the same response within the existing character budget, ranked after direct seed files.

### Changes to `memory_search`

Multiply `ts_rank_cd` score by `importance_score` (normalised 0–1 against max in result set) to boost hub files.

## User Journeys

**Journey A — One-shot recommendation:**
Agent calls `memory_smart_read("apartment preferences")` → BM25 seeds preferences.md → response also includes 8 recent visit notes and 3 chat summaries that reference it → agent answers with full current context in one turn, no follow-up reads.

**Journey B — Memory written, immediately discoverable:**
Agent writes `user/chat-jun01.md` with `[[user/preferences.md]]` → `mx_backlink` row inserted → next smart_read on preferences.md surfaces chat-jun01.md as inbound → importance_score on preferences.md increments.

**Journey C — Orphan detection:**
Admin queries `mx_backlink` for files with 0 inbound links → candidate stale files for dream cleanup.

## Success Criteria

| Criterion | Measurement |
|---|---|
| Inbound files surface in smart_read | Hub file seeded → ≥1 inbound file included in same response when it exists |
| Fewer follow-up reads | `mx_access_log` operation=`read` count per session drops after rollout |
| Hub files rank higher | File with 5+ inbound links outranks equally-relevant file with 0 inbound links |
| No circular traversal | A→B, B→A; smart_read on A terminates without infinite recursion |
| Backlinks stay consistent | Write → links inserted; overwrite with removed link → stale row deleted |
| No latency regression | `memory_smart_read` p95 latency does not increase by more than 20% |

## Test Plan

**Unit tests** (`packages/core/tests/backlinks.test.ts`):
- `extractMemoryLinks` — parses `[[user/foo.md]]`, ignores malformed syntax, deduplicates
- `syncBacklinks` — inserts new links, deletes removed links, idempotent on same content
- Circular pair (A→B, B→A): both synced; `getInboundLinks(A)` returns B and vice versa
- Orphan: file with 0 inbound links returns empty array

**Integration tests** (`packages/core/tests/smart-read-backlinks.test.ts`):
- Write hub + 3 files linking to it → smart_read on hub includes ≥1 inbound in same response
- Overwrite file removing a memory link → stale `mx_backlink` row deleted
- `importance_score` increments on target after each new inbound link

**Regression tests**:
- Forward traversal unchanged: A→B→C → smart_read on A includes B and C
- Circular loop: A→B→C→A — terminates, returns all three exactly once
- Character budget respected even with many inbound files

**Performance test**:
- 1,000 files with random memory-link graph → smart_read completes in < 100ms
