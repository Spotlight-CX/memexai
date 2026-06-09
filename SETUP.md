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
    "Write shared/procedural.md — agent behavior rules, tool policy, what not to memorize",
    "Write shared/semantic.md — schema for user facts (written to user/profile.md)",
    "Write shared/episodic.md — schema for user events (appended to user/log.md)",
    "Optionally write shared/domain.md — product-specific examples for each memory type",
    "Run: memex-admin files write shared/procedural.md --content '...' --reason 'bootstrap'"
  ]
}
```

---

## Step 2 — Decide on memory shape (agent reads codebase)

The agent (not the CLI) reads the codebase to determine what memory categories the product needs. The CLI does not call any LLM — it just executes writes.

MemexAI uses a **cognitive architecture triad** to structure memory at two levels:

| Scope | File | Purpose |
|---|---|---|
| `shared/procedural.md` | How agents must behave — tool rules, write policy, what not to store |
| `shared/semantic.md` | Schema for user facts — what fields to write to `user/profile.md` |
| `shared/episodic.md` | Schema for user events — what to append to `user/log.md` |
| `user/profile.md` | The actual deduplicated facts about this user (semantic instances) |
| `user/log.md` | Time-ordered event log for this user (episodic instances, append-only) |

**Key principle:** `shared/` holds the *schema and rules* for each memory type. `user/` holds the *actual per-user data*. Agents read the shared schema to know *what* to store and *how*, then write to the user namespace.

**HITL signal:** Whenever a Human-in-the-Loop clarifying question is answered by the user, that answer is a prime candidate for memory. Resolved clarifications should almost always be captured — as a fact in `user/profile.md` (semantic) or as a logged decision in `user/log.md` (episodic).

### Template: shared/procedural.md

```markdown
# Agent Behavior Rules (Procedural Memory)

## Memory write policy
- Use `memory_remember` to capture durable facts from user statements.
- Use `memory_patch` for small updates; prefer it over full rewrites.
- Never write one-off lookups (prices, hours, schedules) or raw conversation text.
- Never write personal health, financial, or legal inferences without confirmation.

## Tool selection guide
- Call `memory_context` before any personalized recommendation.
- Call `memory_patch` for field updates; `memory_write` only when creating or fully replacing a file.
- Call `memory_remember` whenever the user states a preference, constraint, or decision.

## HITL signal
Whenever a clarifying question is answered, capture it in user/profile.md (stable fact) or user/log.md (decision/event).

## What NOT to memorize
- Transient statements ("I'm tired today")
- Questions the user is exploring, not deciding
- Anything the user asks to keep private
```

### Template: shared/semantic.md

```markdown
# Semantic Memory Schema

Semantic memory holds stable, deduplicated facts about the user.

## What belongs in `user/profile.md`
- Stated preferences (soft, refinable — patch when updated)
- Hard constraints (non-negotiable blockers)
- Active goals with a time horizon

Format: `- Fact description [YYYY-MM]`
When patching, update the timestamp and remove the old line.

## What NOT to store
- One-off lookups, raw conversation text, transient questions
- Anything the user explicitly asked to forget
```

### Template: shared/episodic.md

```markdown
# Episodic Memory Schema

Episodic memory holds time-ordered events worth carrying forward.

## What belongs in `user/log.md`
- Options viewed and rejected (include the reason)
- Decisions made (booking, accepting, rejecting an offer)
- Goal milestones
- User corrections ("I changed my mind about X")

Format: `- [YYYY-MM] Event — reason if applicable`

## Append-only
Never patch or edit user/log.md. Only append new lines.

## HITL signal
Log the resolved context when a clarifying question represents a meaningful decision.
```

---

## Step 3 — Write shared memory files

```bash
# Write the three cognitive-architecture files
npx @memexai/admin -d $DATABASE_URL files write shared/procedural.md \
  --content "# Agent Behavior Rules..." --reason "bootstrap"

npx @memexai/admin -d $DATABASE_URL files write shared/semantic.md \
  --content "# Semantic Memory Schema..." --reason "bootstrap"

npx @memexai/admin -d $DATABASE_URL files write shared/episodic.md \
  --content "# Episodic Memory Schema..." --reason "bootstrap"

# Optionally write a domain-specific example file
npx @memexai/admin -d $DATABASE_URL files write shared/domain.md \
  --content "# Domain Memory Guidance..." --reason "bootstrap"
```

Or pipe from files:
```bash
npx @memexai/admin -d $DATABASE_URL files write shared/procedural.md \
  --content-file ./shared-procedural.md --reason "bootstrap"
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

Memory shape: real-estate assistant — set up 2026-06-09

## Cognitive architecture

| Layer | File | What it holds |
|---|---|---|
| Procedural | `shared/procedural.md` | Agent behavior rules — tool policy, what not to store |
| Semantic schema | `shared/semantic.md` | Schema for user facts written to `user/profile.md` |
| Episodic schema | `shared/episodic.md` | Schema for events appended to `user/log.md` |
| Semantic instances | `user/profile.md` | Per-user facts: budget, location, preferences |
| Episodic log | `user/log.md` | Per-user events: viewed/rejected properties, decisions |

## What agents store per user

**user/profile.md (semantic):**
- Budget range and financing status
- Location preferences (areas, commute anchors)
- Property requirements (BHK, floor, amenities)

**user/log.md (episodic, append-only):**
- Properties viewed and rejected (with reason)
- Key decisions: shortlisted, visited, made offer

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
