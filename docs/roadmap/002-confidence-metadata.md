# Confidence and Provenance Metadata

## Status: Planned

## Problem

The dream consolidation job (`memory_consolidate`) merges, rewrites, and synthesises memories but has no way to signal that a consolidated result is less certain than the original explicit statement it was derived from. All memories are ranked equally regardless of how they were written or whether they have been contradicted.

Consequences:
- A dream-merged "budget summary" appears alongside the original explicit budget statement with the same search weight — agents can't tell which to trust
- An agent-inferred guess ("probably prefers south-facing") competes equally with a directly stated preference
- When a user updates a preference, the old one persists at full weight until the dream job happens to clean it up

## Proposed Design

### New columns on `mx_file`

```sql
ALTER TABLE mx_file
  ADD COLUMN IF NOT EXISTS confidence REAL NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'explicit';
```

`source_type` enum: `explicit` | `inferred` | `consolidated`

### Ranking change

In `memory_search` and `memory_smart_read`, multiply the base score by `confidence`:

```
final_score = base_score * confidence
```

Default is `1.0` so existing memories are unaffected.

### Tool schema changes

`memory_write` and `memory_patch` in `packages/core/src/tool-definitions.ts` gain optional params:
- `confidence?: number` (0–1, default 1.0)
- `source_type?: 'explicit' | 'inferred' | 'consolidated'`

Zod schemas in `packages/core/src/schemas.ts` updated accordingly.

### Dream consolidation (`memory_consolidate`)

- Sets `source_type = 'consolidated'` on merged output files
- Propagates `confidence = min(input_confidences)` — consolidation cannot increase certainty
- When a contradiction is detected, lowers `confidence` of the older memory rather than deleting it

## User Journeys

**Journey A — Preference update with contradiction:**
1. Old memory: "wants 2BHK" (`confidence: 1.0, source_type: explicit`)
2. User updates: agent writes "prefers 3BHK, June 2026" (`confidence: 1.0, source_type: explicit`)
3. Agent patches old memory: `confidence: 0.2` (contradicted, not deleted)
4. Search "bedroom preference": 3BHK scores `rank × 1.0`, 2BHK scores `rank × 0.2` → 3BHK first
5. Dream job next run: flags low-confidence 2BHK fact, eventually removes it

**Journey B — Dream consolidation preserves epistemic quality:**
1. Dream consolidates 10 budget-related snippets into `user/budget-summary.md` (`source_type: consolidated, confidence: 0.85`)
2. Original explicit statement remains `confidence: 1.0, source_type: explicit`
3. Search "budget": explicit statement ranks above consolidated summary

**Journey C — Inferred vs stated:**
1. Agent infers: "probably prefers south-facing" (`source_type: inferred, confidence: 0.6`)
2. User explicitly states south-facing preference → agent writes `source_type: explicit, confidence: 1.0`
3. Old inferred memory deprecated; explicit one dominates future searches

## Success Criteria

| Criterion | Measurement |
|---|---|
| Confidence affects ranking | `confidence: 0.3` memory ranks below `confidence: 1.0` on same topic |
| Dream sets source_type | After `memory_consolidate`, merged file has `source_type = 'consolidated'` in DB |
| Contradiction lowers confidence | Patching a memory with lower confidence → verified in `mx_file` column |
| Explicit beats inferred | `source_type: explicit` ranks above `source_type: inferred` for identical content |
| Backward compatible | Existing memories default to `confidence: 1.0` — no ranking regression |
| Schema exposed | `memory_write` tool definition includes optional `confidence` + `source_type` |

## Test Plan

**Unit tests** (`packages/core/tests/confidence.test.ts`):
- `rankWithConfidence(results)` — `confidence: 0.3` ranks below `confidence: 1.0` for same base score
- `writeMemory({..., confidence: 0.5, source_type: 'inferred'})` — columns set correctly in `mx_file`
- `patchMemory` with updated confidence — only that column changes
- Defaults: memory written without params gets `1.0` / `'explicit'` in DB

**Integration tests** (`packages/core/tests/confidence-ranking.test.ts`):
- Two memories on same topic, different confidence → `memory_search` returns higher-confidence one first
- `memory_consolidate` on 3 related memories → merged file has `source_type: 'consolidated'`
- Pre-migration rows default to `1.0` / `'explicit'` — no regression

**Dream integration** (`packages/core/tests/dream-confidence.test.ts`):
- Contradicting memories → dream lowers confidence on older one
- Backfill: migration on existing DB rows → all get correct defaults
