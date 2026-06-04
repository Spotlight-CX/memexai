# MemexAI Setup Guide (Agent-Driven, No Browser)

This guide is written for coding agents (Claude Code, Codex, Cursor) performing first-time MemexAI integration. Every step is a CLI command — no browser required.

---

## Prerequisites

- Postgres (or Docker with Compose)
- Node.js 20+ or Bun (for `npx @memexai/admin`)
- `DATABASE_URL` env var pointing to your Postgres database

```bash
# If using Docker Compose (quickest start)
docker compose up -d   # Postgres on port 5433 (default), service on 8080

# DATABASE_URL for Docker default
export DATABASE_URL="postgresql://memexai:memexai@localhost:5433/memexai"
```

---

## Step 1 — Check setup status

```bash
npx @memexai/admin -d $DATABASE_URL --json setup status
```

Expected output if not yet bootstrapped:
```json
{
  "bootstrapped": false,
  "sharedFiles": [],
  "setupCompletedAt": null,
  "setupNote": null,
  "nextSteps": [
    "Write shared/index.md to define agent memory scope",
    "Run: memex-admin files write shared/index.md --content '...' --reason 'bootstrap'"
  ]
}
```

---

## Step 2 — Decide on memory shape (agent reads codebase)

The agent (not the CLI) reads the codebase to determine what memory categories the product needs. The CLI does not call any LLM — it just executes writes.

A minimal `shared/index.md` tells the agent what kinds of things to store:

```markdown
# Memory System

You are an assistant with persistent memory. Store durable facts learned from conversations.

## What to remember per user
- Stated preferences and requirements
- Key decisions or commitments made
- Context that would be lost without it

## What NOT to store
- Conversation history (already in chat context)
- Temporary state or exploratory questions
- Anything the user explicitly said to forget

## Paths
- user/index.md — index of all user memory files
- user/log.md — chronological log of memory writes (append only)
- shared/user-memory.md — this schema guide (read-only)
```

---

## Step 3 — Write shared memory files

```bash
# Write the index/schema guide
npx @memexai/admin -d $DATABASE_URL files write shared/index.md \
  --content "# Memory System
..." \
  --reason "initial bootstrap"

# Optionally write a user memory schema guide
npx @memexai/admin -d $DATABASE_URL files write shared/user-memory.md \
  --content "# User Memory Schema
..." \
  --reason "initial bootstrap"
```

Or pipe from a file:
```bash
npx @memexai/admin -d $DATABASE_URL files write shared/index.md \
  --content-file ./shared-index.md --reason "bootstrap"
```

---

## Step 4 — Mark setup complete

```bash
npx @memexai/admin -d $DATABASE_URL setup complete \
  --note "real-estate assistant — stores budget, location, requirements"
```

This writes `setup_completed = true` to `mx_config`.

---

## Step 5 — Verify

```bash
npx @memexai/admin -d $DATABASE_URL --json setup status
# Expected: { "bootstrapped": true, "sharedFiles": ["shared/index.md", ...] }

npx @memexai/admin -d $DATABASE_URL files list --prefix shared/
# Expected: table of shared/ files with sizes
```

---

## Step 6 — Write MEMEX.md to the project repo

The agent should write a `MEMEX.md` file documenting the memory setup for future agents and developers. The CLI does not generate this — it's the agent's job.

Example `MEMEX.md`:
```markdown
# MemexAI Memory Setup

Memory shape: real-estate assistant — set up 2025-06-04

## Shared files
- `shared/index.md` — system context, guides what agents should memorize
- `shared/user-memory.md` — schema for user-level categories

## What agents store per user
- Budget range and financing status
- Location preferences (areas, commute anchors)
- Property requirements (BHK, floor, amenities)
- Visited properties and reactions

## Admin CLI quick reference

# Check setup status
memex-admin -d $DATABASE_URL setup status

# Inspect a user's current memory
memex-admin -d $DATABASE_URL files list --prefix users/<userId>/
memex-admin -d $DATABASE_URL files get users/<userId>/profile.md

# Debug what an agent wrote in a session
memex-admin -d $DATABASE_URL --json logs list --user <userId> --from 1h
memex-admin -d $DATABASE_URL trace <toolCallId>

# Time-travel: what was in memory at the time of a past request?
memex-admin -d $DATABASE_URL memory snapshot --user <userId> --at "2025-06-03T14:22:00Z"

# Re-run setup if memory schema needs adjustment (safe to re-run)
memex-admin -d $DATABASE_URL files write shared/index.md --content "..." --reason "update"
memex-admin -d $DATABASE_URL setup complete --note "updated schema"
```

Commit `MEMEX.md` to the repo — it's the contract between the codebase and the memory system.

---

## Step 7 — Run a test agent call

```bash
# If using the demo agent
bun run demo:agent -- "I prefer 2BHK apartments in Koramangala with a budget of 80L"
```

---

## Step 8 — Verify what the agent wrote

```bash
# Find the user's files
npx @memexai/admin -d $DATABASE_URL files list --prefix users/demo_user/

# Read a specific file
npx @memexai/admin -d $DATABASE_URL files get users/demo_user/profile.md

# See the revision trail for the file
npx @memexai/admin -d $DATABASE_URL revisions list --path users/demo_user/profile.md
```

---

## Debugging memory issues

### Something looks wrong — what did the agent actually do?

```bash
# 1. Find recent access logs for the user
npx @memexai/admin -d $DATABASE_URL --json logs list --user alice --limit 20

# 2. Find the tool_call_id from a suspicious log entry, then trace it
npx @memexai/admin -d $DATABASE_URL trace tc_abc123
```

### What did memory look like at the time of a specific request?

```bash
# Time-travel to the exact moment
npx @memexai/admin -d $DATABASE_URL memory snapshot --user alice \
  --at "2025-06-03T14:22:00Z"

# See what changed between the last two writes
npx @memexai/admin -d $DATABASE_URL memory diff users/alice/profile.md \
  --rev-a 1 --rev-b 0
```

### Memory looks corrupted or wrong — roll back manually

```bash
# Get the content from a previous revision
npx @memexai/admin -d $DATABASE_URL --json revisions list \
  --path users/alice/profile.md --limit 5

# Write it back (replace with old content)
npx @memexai/admin -d $DATABASE_URL files write users/alice/profile.md \
  --content "..." --reason "manual rollback from admin"
```

---

## Re-running setup (safe, idempotent)

```bash
# Update shared memory files at any time
npx @memexai/admin -d $DATABASE_URL files write shared/index.md \
  --content "..." --reason "updated schema v2"

# Re-mark complete with updated note
npx @memexai/admin -d $DATABASE_URL setup complete \
  --note "real-estate assistant v2 — added investment property category"

# Verify
npx @memexai/admin -d $DATABASE_URL setup status
```

Updating `shared/` files never affects existing user memory (`users/*/`).
