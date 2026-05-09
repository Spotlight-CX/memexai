import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { Db } from "./db"

function migrationsDir() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "migrations")
}

export async function runMigrations(db: Db): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS mx_migration (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const dir = migrationsDir()
  const files = (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort()

  for (const file of files) {
    const { rows } = await db.query<{ id: string }>("SELECT id FROM mx_migration WHERE id = $1", [file])
    if (rows.length > 0) continue

    const sql = await readFile(join(dir, file), "utf8")
    const client = await db.connect()
    try {
      await client.query("BEGIN")
      await client.query(sql)
      await client.query("INSERT INTO mx_migration (id) VALUES ($1)", [file])
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}
