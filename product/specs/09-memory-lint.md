# Spec: Memory Lint

**Priority:** Tier 3 — post-launch  
**API:** `memory_lint` tool + `user.lint({ model })` convenience method  
**Status:** Not started  
**Status:** Not started

---

## Why

As a user's memory grows — dozens of files across sessions — quality degrades silently:
- Orphan files accumulate (written once, never linked or referenced)
- Contradictions appear (session 10 wrote a budget update, session 3's fact is now stale)
- `user/index.md` drifts out of sync (file was written but the index entry is missing or wrong)
- Related files that should link to each other don't

None of this triggers an error. Memory just quietly gets harder to navigate and trust.

Lint is the repair mechanism: a periodic health-check pass that surfaces problems and optionally fixes trivial ones. Karpathy: *"The LLM is good at suggesting new questions to investigate and new sources to look for."*

---

## What

A new agentic tool `memory_lint` that:

1. Reads all user memory files (or a subset via `prefix`)
2. Asks the inner model to identify problems
3. Returns a structured lint report
4. Optionally applies auto-fixes for trivial issues (`autoFix: true`)

### Lint categories

| Category | Description | Auto-fixable |
|---|---|---|
| `orphan` | File exists but no other file links to it, and it's not in `user/index.md` | Add to index |
| `stale` | A fact in a file is contradicted by a more recent file | Flag only (needs human judgment) |
| `missing_index_entry` | File exists but `user/index.md` has no entry for it | Add entry |
| `broken_link` | A `[[user/file.md]]` reference points to a file that doesn't exist | Flag only |
| `missing_crossref` | Two files share subject matter but neither links to the other | Add See also links |
| `no_log_entry` | A file in the index has no corresponding entry in `user/log.md` | Add log entry |

### Output

```ts
{
  issues: [
    {
      category: "orphan",
      path: "user/notes-2026-01.md",
      detail: "Not referenced by any other file and missing from index.md",
      autoFixed: false,
    },
    {
      category: "missing_index_entry",
      path: "user/commute.md",
      detail: "File exists but user/index.md has no entry",
      autoFixed: true,   // if autoFix: true was passed
    },
  ],
  summary: "Found 3 issues: 1 orphan, 1 missing index entry, 1 stale fact.",
  writes: [...],  // same structure as memory_memorize writes, if autoFix produced writes
}
```

---

## API

### Tool (agent-facing)

```
memory_lint — Health-check user memory. Finds orphan files, stale facts, missing
cross-references, and index drift. Optionally auto-fixes trivial issues.

Parameters:
  prefix?    string   Filter to a path prefix, e.g. "user/projects/"
  autoFix?   boolean  Apply trivial fixes (missing index entries, missing log entries)
  dryRun?    boolean  Report without applying fixes
```

### SDK convenience

```ts
const user = memex.forUser({ userId: "user_123", actor: "assistant" })
const report = await user.lint({ model, autoFix: true })
console.log(report.issues)
```

---

## Internal Flow

```
1. List all user files (memory_list with prefix)
2. Read all files (or sample large files to first N chars)
3. Run generateText with:
   - system: "You are a memory quality agent. Review the provided files for:
              orphans, stale facts, missing cross-references, index drift.
              Report each issue with category, path, and a one-line detail.
              If autoFix is enabled, use memory_write/memory_patch to fix
              trivial issues (missing index entries, missing log entries, broken links)."
   - prompt: all file contents serialized as {path, content} list
   - tools: { memory_write, memory_patch }  ← only if autoFix enabled
4. Parse issues from model output
5. Return structured LintResult
```

**Budget:** reading many files in one pass is token-heavy. Mitigations:
- `prefix` filter scopes the pass
- Truncate large files to first 500 chars (enough to detect orphan/stale, enough for link scanning)
- `maxReads` cap (default 30 files)

---

## Implementation

**New function:** `executeMemoryLint` in `packages/core/src/tools.ts`

**New tool definition:** `memory_lint` in `packages/core/src/tool-definitions.ts`

**Wire up:** `executeTool` switch in `packages/core/src/tools.ts`

**SDK method:** `user.lint(options)` on `MemexUser` in `packages/core/src/memex.ts`

**Admin UI trigger:** "Lint" button in FilesView or as a menu item in the admin header. Shows the lint report in a modal. Auto-fix toggle.

---

## Files to Create/Modify

| File | Change |
|---|---|
| `packages/core/src/tools.ts` | Add `executeMemoryLint` function |
| `packages/core/src/tool-definitions.ts` | Add `memory_lint` tool definition |
| `packages/core/src/memex.ts` | Add `user.lint()` method |
| `packages/core/src/index.ts` | Export `LintResult`, `LintIssue` types |
| `apps/service/admin/src/components/FilesView.tsx` | Add "Lint" button → modal |

---

## Verification

1. Manually create some orphan files via admin UI
2. Call `memory_lint` via playground — confirm orphans are detected
3. Pass `autoFix: true` — confirm `user/index.md` is patched with missing entries
4. Run with `dryRun: true` — confirm no writes occur
5. `bun run build:core` passes cleanly
