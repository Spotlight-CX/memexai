# Access Logs

Every tool call — reads and writes — creates a row in `mx_access_log`. Unlike revisions (which only record writes), access logs record every interaction an agent has with memory.

---

## What an access log entry records

| Column | What it stores |
|---|---|
| `id` | Unique log ID |
| `file_id` | Foreign key to `mx_file` (nullable — set to NULL if the file is later deleted) |
| `physical_path` | Full path at time of access (e.g. `users/user_123/profile.md`) |
| `operation` | `list`, `read`, `write`, or `patch` |
| `actor` | Who performed the access (e.g. `"assistant"`, `"onboarding-agent"`) |
| `user_id` | The user whose memory was accessed |
| `tool_call_id` | The LLM's tool call ID for this invocation |
| `created_at` | Timestamp |

Access logs do **not** store file content. That's the job of `mx_revision` (for writes). Access logs are lightweight: one small row per tool call, regardless of file size.

---

## Why access logs?

**Revision history tells you what changed. Access logs tell you what happened.**

A revision answers: *"What did the file contain after this write?"*  
An access log answers: *"What did the agent touch during this conversation?"*

With access logs you can reconstruct the agent's full activity in a session:

1. It read `user/profile.md` (to load context)
2. It called `memory_list` to see what files exist
3. It wrote `user/session-notes.md` with reason "user asked about budget"
4. It patched `user/profile.md` to add a new preference

None of this narrative comes from revisions alone — revisions only cover steps 3 and 4.

---

## Using access logs in the admin UI

The admin UI shows access logs per file and per user. You can see:

- What an agent read vs what it wrote
- The sequence of tool calls within a session (correlated by `tool_call_id`)
- Which actors accessed a user's memory, and when

**Correlating tool calls to LLM responses:** Most LLM frameworks (Vercel AI SDK, Anthropic, OpenAI) include a `toolCallId` in their tool invocation. memexai captures this in `tool_call_id`. If you log the full LLM response alongside your application logs, you can join on `tool_call_id` to reconstruct exactly what the model decided and what it wrote.

---

## Using access logs in SQL

```sql
-- All tool calls for a user in the last 24 hours
SELECT operation, physical_path, actor, tool_call_id, created_at
FROM mx_access_log
WHERE user_id = 'user_123'
  AND created_at > now() - interval '24 hours'
ORDER BY created_at ASC;

-- Which files does the agent read most often?
SELECT physical_path, count(*) AS reads
FROM mx_access_log
WHERE operation = 'read'
GROUP BY physical_path
ORDER BY reads DESC
LIMIT 20;

-- Full activity for a specific tool call ID
SELECT a.operation, a.physical_path, a.actor, a.created_at,
       r.reason, r.content_text
FROM mx_access_log a
LEFT JOIN mx_revision r ON r.tool_call_id = a.tool_call_id
WHERE a.tool_call_id = 'call_abc123';
```

---

## Access logs vs revisions: when to use each

| Question | Use |
|---|---|
| What did the file look like after a specific write? | `mx_revision` |
| What did the agent read during a session? | `mx_access_log` |
| Why was this write made? | `mx_revision.reason` |
| How many times has this file been read this week? | `mx_access_log` |
| What was the exact content before an agent overwrote it? | `mx_revision` (previous row) |
| Which actors have touched this user's memory? | `mx_access_log` |

---

## Retention and file deletion

Access log entries are kept even after the referenced file is deleted. The `file_id` column is set to `NULL` (via `ON DELETE SET NULL`) but the row itself remains. This preserves the audit record — you can still see that a file at a given path was accessed, even after the file is gone.

To purge old access logs:

```sql
DELETE FROM mx_access_log
WHERE created_at < now() - interval '90 days';
```
