import type { Db } from "./db"

const MIGRATIONS = [
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

- Prefer \`memory_memorize\` and \`memory_search\` over raw file tools.
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
]

export async function runMigrations(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS mx_migration (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  for (const migration of MIGRATIONS) {
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
