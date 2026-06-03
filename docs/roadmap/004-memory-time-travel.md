# Memory Time Travel

## Status: Partially done — Files time travel shipped (`c839f06`, `6529050`, `c5c8ab0`). Memory context snapshots remain planned.

## Problem

Teams cannot reconstruct the exact memory context behind an agent decision. Revision history shows how a file changed over time, but it does not show which file versions were exposed to an agent/model during a prompt build or memory tool call.

That gap becomes a compliance and debugging problem:
- A dream pass can rewrite memory before an operator reviews the incident
- Current files may not match the memory an agent saw during a session
- Access logs show reads and writes, but not the complete memory context returned to or used by an agent/model
- External traces can show that a call happened, but not the memory snapshot that shaped it

MemexAI should treat memory exposure as operating state and preserve an inspectable artifact for each request that exposes memory to an agent/model.

## Proposed Shape

### Ship first: revision-based Files time travel

The lowest-lift, highest-priority slice is timestamp time travel in the Files view. It does not need new database schema because `mx_revision` already stores full file snapshots with `physical_path`, `content_text`, and `created_at`.

Implementation shape:
- Add an admin API mode for listing files as of a timestamp
- Query the latest revision for each path where `created_at <= selectedTimestamp`
- Build the historical file tree from those revision paths
- Show selected historical file content in the existing Files content pane
- Add a diff against current `mx_file.content_text`
- Place the time selector in a global Files toolbar because it changes the entire file tree and content context, not only the selected file
- Use a native `datetime-local` input wrapped in Mantine `TextInput` for v1. `@mantine/dates` is not currently installed, and adding a date-picker dependency is not necessary for the first useful version.

Example query shape:

```sql
SELECT DISTINCT ON (physical_path)
  physical_path,
  content_text,
  created_at,
  actor,
  reason
FROM mx_revision
WHERE created_at <= $1
ORDER BY physical_path, created_at DESC;
```

Useful UI:

```text
Files
[Global toolbar: View Current v] [As of: 2026-06-02 12:17]

Left: historical file tree
Center: selected file content at that timestamp
Right:
- Historical revision time
- Actor
- Reason
- [Diff from current]
```

Fuller text layout:

```text
Files
Global toolbar
[View: Current v] [As of timestamp: 2026-06-02 12:17] [Clear] [Copy link]

┌──────────────────────┬──────────────────────────────────────────────┬────────────────────────────┐
│ Explorer             │ users/user_123/preferences.md                │ Time travel                │
│                      │                                              │                            │
│ Historical tree      │ [Current] [As of timestamp] [Diff current]   │ Mode: As of timestamp      │
│ as of 12:17          │                                              │ Timestamp                  │
│                      │ Historical version                           │ 2026-06-02 12:17           │
│ Search files...      │ Last revision before selected time           │                            │
│                      │ Jun 2, 2026 12:03 by assistant               │ Revision                   │
│ shared/              │                                              │ rev_abc123                 │
│   index.md           │ ───────────────────────────────────────────  │ Actor                      │
│   user-memory.md     │                                              │ assistant                  │
│ users/user_123/      │ - Prefers 2BHK apartments                    │ Reason                     │
│   index.md           │ - Budget around ...                          │ memory_memorize            │
│   preferences.md     │ - Avoids aggressive upsells                  │                            │
│   profile.md         │                                              │ Current status             │
│                      │                                              │ Changed since timestamp    │
│                      │                                              │                            │
│                      │                                              │ [Open latest] [Show diff]  │
└──────────────────────┴──────────────────────────────────────────────┴────────────────────────────┘
```

Placement rule:
- The timestamp picker lives in the top/global Files toolbar because changing it rerenders the file tree, selected file content, and diff context.
- The right sidebar does not choose time. It explains the selected historical file: selected timestamp, matched revision, actor, reason, changed-since status, and actions.
- The left tree should visibly indicate historical mode so operators do not confuse an as-of tree with the current tree.
- In time travel mode, do not show the full normal Revisions tab by default. It competes with the mental model of "this is the version matched by the selected timestamp." Show a compact "Matched revision" panel first, with an optional "Nearby revisions" disclosure if operators need to move before/after the selected point.

Component recommendation:
- V1: Mantine `TextInput` with `type="datetime-local"` in the global toolbar, plus quick actions like "Now", "Clear", and "Copy link".
- Later: install `@mantine/dates` and use `DateTimePicker` only if operators need richer calendar/timezone ergonomics.
- Store the selected value in the URL query string, for example `?asOf=2026-06-02T12:17:00.000Z`, so links preserve the historical view.

Diff layout:

```text
Files > Diff from current
┌──────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ As of Jun 2, 2026 12:17                      │ Current                                      │
│ users/user_123/preferences.md                │ users/user_123/preferences.md                │
├──────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ - Prefers 2BHK apartments                    │ - Prefers 3BHK apartments                    │
│ - Budget around ...                          │ - Budget around ...                          │
│ - Avoids aggressive upsells                  │ - Avoids aggressive upsells                  │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┘

Right sidebar
- Historical revision: rev_abc123
- Current revision: rev_xyz789
- Changed by: support-agent
- Changed at: Jun 3, 2026 09:41
```

Limitations:
- This reconstructs file state, not per-request usage
- If old revisions are pruned, older time travel becomes incomplete
- If delete workflows remove file revisions, deleted files cannot be reconstructed without tombstones or retained delete revisions
- Files that somehow exist without revisions will not appear in historical mode

This slice should ship before context snapshots because it is mostly UI plus service query wiring.

### Memory context snapshots

Create a memory context snapshot for every request that exposes memory content to an agent/model. This is parallel to an OpenTelemetry span, but product-specific: it records which memory files influenced the request.

```ts
type MemoryContextSnapshot = {
  snapshotId: string
  kind:
    | "prompt_block"
    | "memory_read"
    | "memory_search"
    | "memory_smart_read"
    | "memory_memorize"
    | "dream_run"
  status: "open" | "complete" | "error"
  userId: string | null
  actor: string | null
  createdAt: string
  completedAt: string | null
  toolCallId: string | null
  sessionId?: string | null
  traceId?: string | null
  promptBlockHash?: string | null
  files: Array<{
    physicalPath: string
    revisionId: string | null
    contentHash?: string | null
    exposure: "injected" | "read" | "search_result" | "internal_context"
  }>
}
```

`contentHash` is optional in v1. `revisionId` is enough when revisions are retained; a hash is useful later for pruning, tamper/equality checks, or external trace metadata that should not expose memory text.

### Request flow

The snapshot behaves like an audit span for memory exposure:

```text
tool or prompt request starts
  create memory_context_snapshot(status = "open")
  run request logic
    whenever file content is exposed to an agent/model:
      append exposure entry
  before response resolves:
    write snapshot + exposure entries
    mark status = "complete"
  if the request errors:
    write snapshot + partial exposures
    mark status = "error"
```

For v1, keep exposure collection in memory during the request and flush it once in a `finally` block. Do not write a database row on every file touch unless crash-perfect auditing becomes necessary.

Only record files whose content influenced the agent/model:
- File content inserted into a prompt block: exposure
- File content returned by `memory_read`: exposure
- File content used or returned by `memory_search`: exposure
- File content assembled by `memory_smart_read`: exposure
- File content read by inner `memory_memorize` or dream-agent reasoning: exposure
- Search candidate path discovered but content not read: not an exposure
- Admin UI read by a human: access log, not memory context snapshot

### Snapshot kinds

Each memory-producing operation creates its own snapshot:

| Kind | When created | Exposure examples |
|---|---|---|
| `prompt_block` | `buildPromptBlock()` / `/v1/prompt-block` | `shared/` files and `user/index.md` injected into the system prompt |
| `memory_read` | Raw file read tool | File content returned to the agent |
| `memory_search` | Agentic recall/search | Files read for synthesis or returned as cited context |
| `memory_smart_read` | Smart context assembly | Files included in the bounded merged context |
| `memory_memorize` | Agentic write path | Files read by the inner model before deciding writes |
| `dream_run` | Background consolidation | Files read by the dream agent before writing revisions |

This means the feature is mostly a **per-request usage snapshot**. Timestamp-based time travel is still useful, but it is the reconstruction layer built from revisions. Memory context snapshots are the audit layer that says which memory actually influenced a specific request.

### Files tab time travel

The Files view should support two related modes:
- **Timestamp time travel:** reconstruct file contents as of a timestamp from revision history.
- **Request snapshot:** show files exposed during a specific prompt build or memory tool invocation.

Current file browsing remains the default.

```text
Files
[User: user_123] [View: Current v] [Jump to timestamp/request...]

Left: file tree
- users/user_123/profile.md
- users/user_123/preferences.md
- shared/user-memory.md

Center: file content as of selected timestamp or request snapshot
[Current] [As of timestamp] [Request snapshot] [Diff from current]

Right: Snapshot details
- snapshot_id
- session/tool correlation
- kind
- prompt hash, if prompt_block
- exposed files
- changed since snapshot
```

### Diff snapshot vs current

Admins should be able to answer:
- What did this file say when the agent acted?
- What does it say now?
- Did a dream pass, manual edit, or later agent write change it?
- Was this file actually exposed to the agent/model, or merely present at that timestamp?

The first useful version can show line-level text diffs for a selected file. A later version can show a snapshot-level summary: files added, removed, changed, or unchanged since the snapshot.

### Trace and event links

Observation events should carry `snapshot_id` when available. OpenTelemetry export should include identifiers, not memory content:

```text
memex.snapshot_id
memex.user_id
memex.snapshot_kind
memex.files_exposed
memex.prompt_block_hash
```

External trace viewers should link back to the MemexAI snapshot view.

## Product Experience

Primary flow:
1. Operator sees an agent action or incident in an app trace.
2. Trace includes `memex.snapshot_id`.
3. Operator opens the MemexAI request snapshot.
4. Files tab shows memory exposed during that request.
5. Operator diffs historical memory against current memory.
6. Operator can identify whether the action was caused by stale memory, missing memory, or a later memory rewrite.

Secondary flow:
1. Operator opens a user in Files.
2. Chooses a timestamp or recent session.
3. Browses memory as it existed then.
4. Opens the right sidebar to inspect snapshot metadata and changed-since indicators.

Third flow:
1. Operator opens an access-log or observation event for `memory_search`.
2. Event links to a `memory_search` snapshot.
3. Snapshot shows which files were read for recall and which were returned to the agent.
4. Operator can separate "the memory existed" from "the memory influenced this tool response."

## Success Criteria

| Criterion | Measurement |
|---|---|
| Snapshot exists for memory exposure | Prompt builds and read tools create context snapshots |
| Snapshot is reconstructable | Admin can list exposed file paths, revision IDs, kind, status, and request correlation |
| Timestamp time travel works | Selecting a timestamp reconstructs historical file content from revisions |
| Request snapshot works | Selecting a snapshot shows files exposed during that request |
| Diff is usable | Admin can compare selected snapshot content against current content |
| Trace linkage works | Observation events and OTEL attributes can carry `snapshot_id` without memory content |

## Open Questions

- Should snapshots store full file content, revision references, optional hashes, or some combination?
- Should multiple tool calls in one session be grouped under a parent session context?
- How long should memory context snapshots be retained by default?
- Should snapshot creation be optional for direct Postgres mode, service mode, or both?
