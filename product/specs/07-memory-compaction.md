# Spec: Memory Compaction

**Priority:** Tier 3 — post-launch  
**API:** automatic + manual trigger  
**Status:** Not started

---

## Why

High-frequency agents accumulate unbounded memory. A user who chats daily for a year will have a `user/profile.md` with thousands of lines — many redundant, superseded, or low-signal. This breaks the context assembler's budget and degrades recall quality.

Compaction is the maintenance layer that keeps memory lean. No current competitor ships this as a built-in feature. It's a meaningful differentiation for long-running agents.

---

## What It Does

When a file exceeds a configurable size threshold, compaction:
1. Reads the current content
2. Calls an LLM to summarize and deduplicate while preserving durable facts
3. Archives the original under `user/archive/`
4. Overwrites the original with the compacted version
5. Creates a revision with `reason: "auto-compaction"`

The file structure and headings are preserved. The output is shorter but semantically equivalent.

---

## Trigger modes

### 1. On-write (automatic)

After every successful `memory_write` or `memory_patch`, check if the file exceeds the threshold. If yes, trigger compaction asynchronously (after returning the tool result to the agent — don't block the write).

```ts
// In tools.ts, after successful write:
if (finalContent.length > compactionThreshold) {
  scheduleCompaction(db, physicalPath, ctx, options)  // non-blocking
}
```

### 2. Manual via admin UI

New "Compact" button per file in the admin UI. Shows: current size, estimated tokens, last compaction date. On click: triggers compaction immediately and shows the result diff.

### 3. Scheduled (future)

A cron-like job that scans all files nightly and compacts any over threshold. Not in v1.

---

## Compaction algorithm

```
1. Read current file content from mx_file

2. Determine if compaction is needed:
   - content.length > threshold (default: 16000 chars ≈ 4K tokens)

3. Archive original:
   - Write to user/archive/{filename}-{iso-timestamp}.md
   - This creates a revision and access log entry

4. LLM compaction call:
   system: "You are a memory curator. Compress this memory file.
            Rules:
            - Keep all durable facts (preferences, constraints, confirmed data)
            - Remove: duplicate entries, superseded information, low-signal observations
            - Preserve the exact heading structure
            - Do not invent facts not present in the original
            - Keep the output under {targetChars} characters"
   prompt: <current file content>
   
5. Validate output:
   - Must be shorter than original
   - Must not be empty
   - Must preserve at least one heading if original had headings

6. Overwrite original:
   - memory_write with compacted content
   - reason: "auto-compaction: {originalChars} → {newChars} chars"

7. Return: { originalChars, newChars, archivePath, savings: "N%" }
```

---

## Configuration

**Container mode (env vars):**
```bash
MEMEX_COMPACTION_THRESHOLD=16000   # chars (default: off / 0 = disabled)
MEMEX_COMPACTION_MODEL=gemini-2.5-flash  # model to use for summarization
MEMEX_COMPACTION_TARGET=0.5        # target: compress to 50% of original (default)
```

**Direct Postgres mode:**
```ts
const memex = createMemex(DATABASE_URL, {
  compaction: {
    threshold: 16000,
    model: google("gemini-2.5-flash"),
    target: 0.5,
  }
})
```

---

## Archive path convention

Original: `user/profile.md`  
Archive: `user/archive/profile-2026-05-13T14-30-00Z.md`

Archives are read-only via normal tools (they're under `user/` scope so the agent can read them). The agent can reference old archives for context if needed.

---

## Admin UI changes

Per-file view:
- Show file size in chars + estimated tokens
- Show "Last compacted: {date}" if compaction has run
- Button: "Compact now" → triggers compaction, shows before/after sizes
- Link to archive files under `user/archive/`

---

## Files to Create/Modify

| File | Change |
|---|---|
| `packages/core/src/compaction.ts` | New — compactFile() function |
| `packages/core/src/memex.ts` | Accept compaction options in constructor, expose compactFile() on MemexUser |
| `packages/core/src/tools.ts` | Post-write threshold check (non-blocking) |
| `apps/service/src/server.ts` | Read MEMEX_COMPACTION_* env vars |
| `apps/service/admin/` | Add "Compact" button to file detail view |

---

## Verification

1. Unit test: file over threshold → compaction runs → content shorter → revision created → archive exists
2. Unit test: file under threshold → no compaction
3. Unit test: LLM output fails validation → original preserved, error logged
4. Integration: write a large file (>16K chars), wait for async compaction, verify admin UI shows archive + smaller current file
5. Admin UI: "Compact now" button → spinner → updated file size shown
