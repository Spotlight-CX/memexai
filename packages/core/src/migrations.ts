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
