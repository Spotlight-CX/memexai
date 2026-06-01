# Post-Launch Product Roadmap Flags
**Priority:** P4
**Type:** docs
**Status:** [ ] not started

## What
Log four product-level issues that are not PH-blocking but should enter the product roadmap after launch. Each item has the relevant file path so an engineer can pick it up without additional research.

## Flags

### 1. Optimistic locking on `mx_file`
**Problem:** `memory_write` uses `INSERT ... ON CONFLICT DO UPDATE` in `packages/core/src/tools.ts`. Two concurrent agent writes silently last-write-wins. No version field, no retry.
**Fix:** Add `version integer DEFAULT 0` to `mx_file` in `packages/core/src/migrations.ts`. Accept optional `expectedVersion` in the write tool args. If current version != expectedVersion, return a conflict error.
**Files:** `packages/core/src/migrations.ts`, `packages/core/src/tools.ts`, `packages/core/src/tool-definitions.ts`

### 2. Automated `mx_revision` retention policy
**Problem:** `mx_revision` and `mx_access_log` grow unbounded. No TTL, no partitioning, no automatic cleanup in `packages/core/src/migrations.ts`.
**Fix:** Add an optional `MEMEX_REVISION_TTL_DAYS` env var. If set, the Dreaming scheduler (or a separate cron) runs `DELETE FROM mx_revision WHERE created_at < now() - ($1 days)::interval`. Surface TTL config in admin UI settings.
**Files:** `packages/core/src/migrations.ts`, `packages/core/src/dream-scheduler.ts` (or new `packages/core/src/retention.ts`), `apps/service/admin/src/`

### 3. Per-user Dreaming cost budget
**Problem:** `executeMemoryConsolidate` in `packages/core/src/tools.ts` has per-run caps (maxWrites=10, maxFiles=20, maxInputChars=120k) but no per-user cumulative token budget across dream cycles. At scale, the scheduler can burn significant token spend silently.
**Fix:** Add `dream_budget_chars_per_day` config option. Track cumulative input chars per userId per day in `mx_access_log` or a new `mx_dream_budget` table. Skip dream cycle if budget exhausted.
**Files:** `packages/core/src/tools.ts`, `packages/core/src/dream-scheduler.ts`, possibly `packages/core/src/migrations.ts`

### 4. Per-file Dreaming exclusion annotation
**Problem:** `DREAM_EXCLUDED_PATHS` is a global constant. No per-file opt-out mechanism. If an operator or agent wants to protect a specific file from consolidation, there's no way to annotate it.
**Fix:** Add a frontmatter or special comment convention (e.g., `<!-- dreaming: disabled -->` or a `mx_file.dream_excluded` boolean column) that prevents Dreaming from reading or writing a specific file.
**Files:** `packages/core/src/tools.ts` (consolidation read loop), `packages/core/src/migrations.ts`

## Done when
- All 4 items are listed with file references and a 1-sentence fix description
- This file is referenced in the product roadmap or GitHub issues after launch
