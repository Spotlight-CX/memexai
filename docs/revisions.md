# Revision History

Every write operation — whether `memory_write` or `memory_patch` — creates a row in `mx_revision`. Reads do not create revisions (they create access log entries instead; see [access-logs.md](access-logs.md)).

---

## What a revision records

| Column | What it stores |
|---|---|
| `id` | Unique revision ID |
| `file_id` | Foreign key to `mx_file` |
| `physical_path` | Full path at time of write (e.g. `users/user_123/profile.md`) |
| `operation` | `write` or `patch` |
| `content_text` | **Full file content after this write** |
| `reason` | Optional human-readable explanation (from the agent's `reason` argument) |
| `actor` | Who performed the write (e.g. `"assistant"`, `"onboarding-agent"`) |
| `user_id` | The user whose memory was written |
| `tool_call_id` | The LLM's tool call ID for this specific invocation |
| `created_at` | Timestamp |

`content_text` stores the full file content, not a diff. This is intentional: reconstructing any point-in-time state requires only one row, with no need to replay a chain of patches.

---

## Why full snapshots instead of diffs?

Memory files are typically small (a few KB at most). The overhead of storing full snapshots is negligible, and the benefit is large:

- **No replay chain.** To see what the file looked like three writes ago, fetch that revision row.
- **No corruption risk.** A corrupt intermediate state in a diff chain can break all subsequent reconstructions. Each revision stands alone.
- **Auditing is straightforward.** You can answer "what exactly did the agent write, and when?" by reading one row.

---

## Using revisions in the admin UI

The admin UI shows the revision list for any file. For each revision you can see:

- The actor and the timestamp
- The `reason` string the agent provided
- The `tool_call_id` (useful for correlating a write with a specific LLM response)
- The full content at that point in time

**The `reason` field is important to fill in.** When writing or patching, agents should always provide a reason:

```ts
await user.write("user/profile.md", content, "User confirmed preference for quiet neighborhoods")
```

Without a reason, revisions are hard to audit. A good reason answers: *why was this write necessary at this moment?*

---

## Using revisions in SQL

If you need to query revisions directly:

```sql
-- All revisions for a specific user, newest first
SELECT id, operation, reason, actor, tool_call_id, created_at
FROM mx_revision
WHERE user_id = 'user_123'
ORDER BY created_at DESC;

-- Full content of the file two writes ago
SELECT content_text, created_at, reason
FROM mx_revision
WHERE physical_path = 'users/user_123/profile.md'
ORDER BY created_at DESC
LIMIT 1 OFFSET 2;

-- Find the write that corresponds to a specific tool call
SELECT *
FROM mx_revision
WHERE tool_call_id = 'call_abc123';
```

---

## Revision retention

Revisions are never automatically deleted. If you need to implement retention, add a cleanup job:

```sql
-- Delete revisions older than 90 days (keeps current file content intact)
DELETE FROM mx_revision
WHERE created_at < now() - interval '90 days';
```

Deleting from `mx_revision` does not affect `mx_file` (the current content). The foreign key is `ON DELETE CASCADE` in the other direction — if a file is deleted, its revisions are also deleted.

---

## Cascade on file delete

If you delete a row from `mx_file` (e.g. to purge a user's data), all revisions for that file are deleted automatically via `ON DELETE CASCADE`. The `mx_access_log` entries for deleted files have their `file_id` set to `NULL` (via `ON DELETE SET NULL`) but the log row itself is kept for audit purposes.
