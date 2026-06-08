import type { Db } from "./db"

const MIGRATIONS: { id: string; sql: string; vectorOnly?: boolean }[] = [
  {
    id: "001_init.sql",
    sql: `
CREATE TABLE IF NOT EXISTS mx_migration (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mx_file (
  id TEXT PRIMARY KEY,
  physical_path TEXT NOT NULL UNIQUE,
  content_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mx_file_updated_idx ON mx_file (updated_at DESC);

CREATE TABLE IF NOT EXISTS mx_revision (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES mx_file(id) ON DELETE CASCADE,
  physical_path TEXT NOT NULL,
  operation TEXT NOT NULL,
  content_text TEXT NOT NULL DEFAULT '',
  reason TEXT,
  actor TEXT,
  user_id TEXT,
  tool_call_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mx_revision_file_idx ON mx_revision (file_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_revision_user_idx ON mx_revision (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_revision_tool_call_idx ON mx_revision (tool_call_id);

CREATE TABLE IF NOT EXISTS mx_access_log (
  id TEXT PRIMARY KEY,
  file_id TEXT REFERENCES mx_file(id) ON DELETE SET NULL,
  physical_path TEXT NOT NULL,
  operation TEXT NOT NULL,
  actor TEXT,
  user_id TEXT,
  tool_call_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mx_access_log_path_idx ON mx_access_log (physical_path, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_access_log_user_idx ON mx_access_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_access_log_tool_call_idx ON mx_access_log (tool_call_id);
    `.trim(),
  },
  {
    id: "002_search_vector.sql",
    sql: `
ALTER TABLE mx_file ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content_text)) STORED;

CREATE INDEX IF NOT EXISTS mx_file_search_idx ON mx_file USING gin(search_vector);
    `.trim(),
  },
  {
    id: "003_baseline_seed.sql",
    sql: `
WITH seed_files AS (
  SELECT *
  FROM (
    VALUES
      (
        'file_seed_shared_index',
        'shared/index.md',
        '# Shared Memory Index

\`shared/\` is read-only context managed by the operator. It is visible to every user and should contain product guidance, durable rules, and workspace-level context.

## Spaces

- \`shared/\` is global, read-only memory for all users.
- \`user/\` is each user''s writable memory workspace.

Use this file to orient agents before they read or write user-specific memory.'
      ),
      (
        'file_seed_demo_user_index',
        'users/demo_user/index.md',
        '# User Memory Index

This file is the starter index for the virtual \`user/\` workspace. Agents see this path as \`user/index.md\` when acting for \`demo_user\`.

## How to use user memory

- Store stable, durable facts in \`user/\`.
- Prefer clear topic files like \`user/profile.md\`, \`user/preferences.md\`, or \`user/projects.md\`.
- Update this index when adding important files or sections.

This starter file contains guidance only and no fake user preferences.'
      )
  ) AS seed(id, physical_path, content_text)
),
inserted_files AS (
  INSERT INTO mx_file (id, physical_path, content_text)
  SELECT id, physical_path, content_text
  FROM seed_files
  ON CONFLICT (physical_path) DO NOTHING
  RETURNING id, physical_path, content_text
),
inserted_revisions AS (
  INSERT INTO mx_revision (id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id)
  SELECT
    'rev_seed_003_' || regexp_replace(physical_path, '[^a-zA-Z0-9]+', '_', 'g'),
    id,
    physical_path,
    'write',
    content_text,
    'Baseline seed migration',
    'system',
    CASE
      WHEN physical_path = 'users/demo_user/index.md' THEN 'demo_user'
      ELSE NULL
    END,
    'seed_003_baseline'
  FROM inserted_files
  RETURNING file_id, physical_path, user_id
)
INSERT INTO mx_access_log (id, file_id, physical_path, operation, actor, user_id, tool_call_id)
SELECT
  'log_seed_003_' || regexp_replace(physical_path, '[^a-zA-Z0-9]+', '_', 'g'),
  file_id,
  physical_path,
  'write',
  'system',
  user_id,
  'seed_003_baseline'
FROM inserted_revisions;
    `.trim(),
  },
  {
    id: "004_richer_shared_memory.sql",
    sql: `
UPDATE mx_file
SET content_text = $m$# Memory System

\`shared/\` is operator-controlled context. \`user/\` is each user's writable workspace.

## Files in this shared space

- \`shared/user-memory.md\` — How agents should manage user memory.

## Spaces

- \`shared/\` — Operator rules and domain context. Read-only for agents.
- \`user/\` — User's personal memory workspace. Write freely.

## Quick rules

- Prefer \`memory_remember\` and \`memory_context\` over raw file tools.
- Use \`memory_list\` before assuming what files exist under \`user/\`.
- Read \`user/index.md\` on first turn; infer structure if it doesn't exist.$m$,
    updated_at = now()
WHERE physical_path = 'shared/index.md'
  AND length(content_text) < 300;

INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_004_user_memory',
  'shared/user-memory.md',
  $m2$# User Memory Guide

Defines how agents should manage user-level memory in this workspace.

## What to memorize

Store facts that are **stable, specific, and decision-relevant**:
- Stated preferences and constraints
- Corrections with context
- Decisions and their reasoning

Do NOT memorize raw conversation text, one-time lookups, or things the user can easily re-state.

## How to organize user memory

Use \`user/\` like a personal filesystem. No required schema:
- \`user/index.md\` — registry of what exists and what it covers
- \`user/profile.md\` — identity, lifestyle, constraints
- \`user/<topic>.md\` — domain-specific files as needed

When creating a new file, add a one-line entry to \`user/index.md\`.

## Format rules

- Key-value or bullet style. Avoid prose.
- Patch to update; don't overwrite a file for a single fact.
- State the fact, not the conversation.$m2$
)
ON CONFLICT (physical_path) DO NOTHING;
    `.trim(),
  },
  {
    id: "005_dream_tables.sql",
    sql: `
CREATE TABLE IF NOT EXISTS mx_dream_run (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle',
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  last_dreamed_at TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  files_touched INT,
  error TEXT,
  dream_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mx_dream_run_user_idx ON mx_dream_run (user_id);
CREATE INDEX IF NOT EXISTS mx_dream_run_status_idx ON mx_dream_run (status, last_started_at);

CREATE TABLE IF NOT EXISTS mx_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO mx_config (key, value, description) VALUES
  ('dream_enabled', 'false', 'Master switch for the dream loop (opt-in)'),
  ('dream_interval_minutes', '60', 'How often the cron tick fires'),
  ('dream_grace_period_minutes', '30', 'Min quiet time after last write before dreaming'),
  ('dream_max_writes', '10', 'Max write/patch calls per dream run'),
  ('dream_concurrency', '3', 'Max concurrent dream runs per cron tick')
ON CONFLICT (key) DO NOTHING;
    `.trim(),
  },
  {
    id: "006_observation_events.sql",
    sql: `
CREATE TABLE IF NOT EXISTS mx_observation_event (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INT,
  user_id TEXT,
  actor TEXT,
  tool_name TEXT,
  operation TEXT,
  physical_path TEXT,
  tool_call_id TEXT,
  error_code TEXT,
  trace_id TEXT,
  span_id TEXT,
  parent_span_id TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mx_observation_event_created_idx ON mx_observation_event (created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_user_idx ON mx_observation_event (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_tool_idx ON mx_observation_event (tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_status_idx ON mx_observation_event (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_path_idx ON mx_observation_event (physical_path, created_at DESC);
CREATE INDEX IF NOT EXISTS mx_observation_event_trace_idx ON mx_observation_event (trace_id);
    `.trim(),
  },
  {
    id: "007_pgvector_embeddings.sql",
    vectorOnly: true,
    sql: `
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE mx_file
  ADD COLUMN IF NOT EXISTS embedding vector(768),
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_strategy TEXT,
  ADD COLUMN IF NOT EXISTS embedding_chunk_count INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_content_hash TEXT,
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS mx_file_embedding_idx
  ON mx_file USING hnsw (embedding vector_cosine_ops);
    `.trim(),
  },
  {
    id: "008_rich_seed.sql",
    sql: `
-- Upgrade shared/index.md to the richer taxonomy-aware seed.
-- Skips customized setups that already contain a taxonomy section.
UPDATE mx_file
SET content_text = $m8$# MemexAI Memory

\`shared/\` is read-only guidance for all agents. \`user/\` is each user's private writable workspace.

## Shared files

- \`shared/user-memory.md\` — rules for what to store, patch, and ignore
- \`shared/domain.md\` — product-specific memory categories and examples

## Expected user files

| File | What belongs here |
|---|---|
| \`user/index.md\` | Registry of all user files and what they cover |
| \`user/preferences.md\` | Durable soft preferences — refinable over time |
| \`user/constraints.md\` | Hard blockers — budget ceilings, allergies, banned options |
| \`user/goals.md\` | Active intentions — mark completed when resolved |
| \`user/history.md\` | Key events and decisions — append-only |

## Memory taxonomy

- **Preference** — soft, refinable. Patch when updated. \`- Prefers boutique hotels [2025-01]\`
- **Constraint** — hard blocker. Never override without explicit correction. \`- No peanuts (allergy) [2025-01]\`
- **Goal** — time-bound. Mark done when resolved. \`- Trip to Bali, Q3 2025 [open]\`
- **Episode** — what happened. Append to \`history.md\` only; never patch. \`- Booked Seminyak villa [2025-03]\`

## Timestamp convention

Append \`[YYYY-MM]\` when writing a fact. Update the timestamp when patching. This is the only recency signal — revisions track file-level history, not line-level.

## What NOT to store

- One-off lookups (prices, hours, transit schedules)
- Emotional venting with no durable signal
- Information about other people the user mentioned
$m8$,
    updated_at = now()
WHERE physical_path = 'shared/index.md'
  AND content_text NOT LIKE '%Memory taxonomy%';

-- Upgrade shared/user-memory.md with timestamp convention and correction examples.
-- Skips customized setups that already document the timestamp convention.
UPDATE mx_file
SET content_text = $m8b$# User Memory Rules

## What to store

Store facts that are **stable, specific, and decision-relevant**:
- Stated preferences (soft, refinable — patch when the user updates them)
- Hard constraints (blockers — treat as immovable until explicitly corrected)
- Active goals with a time horizon (mark done when resolved)
- Key decisions or events worth carrying forward

## What NOT to store

- One-off lookups the user can easily re-ask (prices, hours, schedules)
- Raw conversation text or session summaries
- Transient searches or exploratory questions
- Anything the user explicitly said to forget

## How to organize user memory

Each user gets a private \`user/\` namespace. Suggested layout:
- \`user/index.md\` — one-line registry of what files exist
- \`user/preferences.md\` — soft preferences, patchable
- \`user/constraints.md\` — hard rules, high-priority
- \`user/goals.md\` — active intentions, mark done when resolved
- \`user/history.md\` — key events, append-only

Create \`user/<topic>.md\` for domain-specific clusters as needed.

## Timestamp convention

When writing a new fact, append the month learned: \`- Prefers X [YYYY-MM]\`.
When patching, update the timestamp to the current month.
This is the only recency signal — \`mx_revision\` tracks file-level history, not line-level.

## Corrections

Patch the existing file. Do not leave the old fact alongside the new one.
- Wrong: \`- Prefers boutique hotels [2025-01]\` and \`- Prefers city hotels [2025-03]\` (both present)
- Right: \`- Prefers city hotels [2025-03]\` (old line removed)
$m8b$,
    updated_at = now()
WHERE physical_path = 'shared/user-memory.md'
  AND content_text NOT LIKE '%Timestamp convention%';

-- Seed shared/domain.md for the first time with a travel-assistant example.
-- Uses ON CONFLICT DO NOTHING — never overwrites an existing domain.md.
INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_008_domain',
  'shared/domain.md',
  $m8c$# Domain Memory Guidance

Replace this file with memory categories specific to your product.
The travel assistant example below shows all four memory types in practice.

---

## Example: Travel Assistant

### Preferences (\`user/preferences.md\`)
Soft facts, refinable. Patch when the user updates them.

- Accommodation style: boutique / resort / hostel / chain
- Seat preference: window / aisle / no preference
- Travel pace: packed itinerary / relaxed / mix
- Companions: solo / couple / family / with pets

### Constraints (\`user/constraints.md\`)
Hard blockers. Never override without explicit correction.

- Budget ceiling per night (e.g. \`- Max $200/night [2025-01]\`)
- Pet-friendly required
- Dietary restrictions or allergies
- Accessibility requirements
- Brands or hotel chains to avoid

### Goals (\`user/goals.md\`)
Active intentions with a time horizon. Mark \`[done]\` when resolved.

- \`- Trip to Bali, Q3 2025 [open]\`
- \`- Weekend city break, budget £300 total [open]\`
- \`- Anniversary trip to Paris, June 2025 [booked]\`

### Episodes (\`user/history.md\`)
What happened. Append-only — never patch, only append.

- \`- Booked Seminyak villa via Airbnb [2025-03]\`
- \`- Rejected Hotel X: too close to main road [2025-01]\`
- \`- Chose train over flight for Paris trip — preferred pace [2025-04]\`

The rejection reason is the most valuable part of an episode.
It prevents re-suggesting options the user has already ruled out.

---

## Judgment calls

| User says | Memory type | Action |
|---|---|---|
| "I usually prefer..." | Preference | Store in preferences.md |
| "I will never..." | Constraint | Store in constraints.md |
| "I'm planning to..." | Goal | Store in goals.md with status \`[open]\` |
| "I tried X and hated it" | Episode | Append to history.md with reason |
| "What's the price of..." | None | Do not store — transient lookup |
$m8c$
)
ON CONFLICT (physical_path) DO NOTHING;
    `.trim(),
  },
]

export async function runMigrations(db: Db, options: { vectorEnabled?: boolean } = {}): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS mx_migration (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  for (const migration of MIGRATIONS) {
    if (migration.vectorOnly && !options.vectorEnabled) continue
    const { rows } = await db.query<{ id: string }>("SELECT id FROM mx_migration WHERE id = $1", [migration.id])
    if (rows.length > 0) continue

    const client = await db.connect()
    try {
      await client.query("BEGIN")
      await client.query(migration.sql)
      await client.query("INSERT INTO mx_migration (id) VALUES ($1)", [migration.id])
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}
