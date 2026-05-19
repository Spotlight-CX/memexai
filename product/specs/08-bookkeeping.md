# Spec: Bookkeeping — Log File + Cross-References

**Priority:** Tier 2 — significant differentiation  
**Status:** Partially done (index.md instruction shipped); log.md + cross-refs pending

---

## Why

A memory system with only fact files is a flat dump. What turns it into a compounding knowledge base is two things:

1. **A chronological log** — lets the model understand what's been memorized recently, without reading all files. Critical for multi-session benchmarks: session 2 should know what session 1 wrote.

2. **Cross-references between pages** — the connections between facts are as valuable as the facts themselves. Without links, a growing memory store becomes a collection of isolated notes. With them, the model can follow trails: `user/profile.md` → `[[user/preferences.md]]` → `[[user/projects/house-hunt.md]]`.

Karpathy's framing: *"The cross-references are already there. The contradictions have already been flagged. The synthesis already reflects everything you've read."* This only holds if the ingestion agent is explicitly instructed to maintain both structures.

Current state: `user/index.md` maintenance was added (Tier 1 partial). `user/log.md` and cross-reference instructions are missing.

---

## What

### 1. `user/log.md` — append-only ingestion log

After every `memory_memorize` call that produces writes, append an entry to `user/log.md`.

Format (grep-parseable with `grep "^-" user/log.md`):
```
- [2026-05-19] wrote user/profile.md — user prefers 2BHK in south Bengaluru
- [2026-05-19] wrote user/projects/house-hunt.md — started tracking house search
- [2026-05-20] patched user/profile.md — updated budget to 1.2Cr
```

The log is append-only — entries are never deleted or reordered. This gives:
- The model a timeline of what's been memorized (reads last N lines, not the whole file)
- The developer a human-readable audit trail alongside the DB `mx_access_log`

### 2. Cross-references between pages

When the inner model writes a new page, it should link to related existing pages using linked references. This turns isolated files into a navigable graph.

Instruction: after writing, check the existing file list for semantically related pages and add a `## See also` section with links. If patching an existing page that now relates to a new one, add the link there too.

Example output in `user/projects/house-hunt.md`:
```markdown
# House Hunt

Started May 2026. Budget: 1.2Cr. Looking in south Bengaluru.

## See also
- [[user/profile.md]] — full preferences
- [[user/commute.md]] — commute constraints
```

---

## Implementation

**File:** `packages/core/src/tools.ts` — `executeMemoryMemorize` system prompt (the array at line ~316)

Add two lines to the inner model's instructions:

```ts
system: [
  "You are a memory ingestion agent.",
  "Extract only durable facts worth remembering.",
  "Use virtual paths only, such as user/profile.md.",
  "Never use physical paths such as users/{userId}/...",
  "Prefer memory_patch when a relevant user file already exists.",
  "Use memory_write only for new user files.",
  "Always include a concise reason.",
  // existing — already shipped:
  "After writing or patching any user file, also update user/index.md: patch it if it exists, write it if not. Add or update a one-line entry per file in the format: `- user/filename.md — <short purpose>`.",
  // new:
  "After all writes, append one line per written file to user/log.md (patch if exists, write if not): `- [YYYY-MM-DD] <wrote|patched> user/filename.md — <reason>`. Use today's date.",
  "When writing a new file, if related files already exist, add a `## See also` section with `[[user/related.md]]` links. When patching, add links if newly relevant.",
  dryRun ? "Dry run is enabled; plan writes but do not commit them." : "Commit useful writes.",
].join("\n"),
```

**Budget note:** default `maxWrites: 5`. With these instructions, a typical session produces: 1 fact write + 1 index.md patch + 1 log.md patch = 3 writes. Well within budget. No need to raise the default.

---

## Edge cases

- **log.md doesn't exist**: model uses `memory_write`. First entry bootstraps the file.
- **Date accuracy**: the model uses today's date from context or makes a best-effort guess. Close enough for a log; we're not building an audit DB.
- **Cross-refs on short sessions**: if only one file is written and no related files exist, the model skips the See also section. No harm.
- **Circular links**: acceptable. The lint tool (spec 09) can flag these if they become noise.

---

## Files to Modify

| File | Change |
|---|---|
| `packages/core/src/tools.ts` | Add 2 lines to the system prompt in `executeMemoryMemorize` |

No schema changes, no new tools, no API surface changes.

---

## Verification

1. Run `bun run demo:agent -- "Remember I prefer 2BHK in south Bengaluru, budget 1.2Cr"`
2. Check admin UI → confirm 3 writes: `user/preferences.md` (or similar), `user/index.md`, `user/log.md`
3. Run a second session with different facts — confirm `user/log.md` now has 2 entries
4. Check that a written file includes a `## See also` section pointing to a related existing file
5. Verify `bun run build:core` still passes cleanly
