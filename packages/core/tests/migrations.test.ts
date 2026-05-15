import { describe, expect, test, vi } from "vitest"
import { runMigrations } from "../src/migrations"

function createMockDb(appliedIds: string[] = []) {
  const client = {
    query: vi.fn(async () => ({ rows: [] })),
    release: vi.fn(),
  }
  const db = {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("SELECT id FROM mx_migration")) {
        return { rows: appliedIds.includes(values?.[0] as string) ? [{ id: values?.[0] }] : [] }
      }
      return { rows: [] }
    }),
    connect: vi.fn(async () => client),
    end: vi.fn(async () => {}),
  }
  return { db: db as unknown as import("../src/db").Db, client }
}

describe("runMigrations", () => {
  test("includes idempotent search vector migration", async () => {
    const { db, client } = createMockDb()

    await runMigrations(db)

    const migrationSql = client.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql): sql is string => typeof sql === "string")
      .join("\n")

    expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS search_vector tsvector")
    expect(migrationSql).toContain("GENERATED ALWAYS AS (to_tsvector('english', content_text)) STORED")
    expect(migrationSql).toContain("CREATE INDEX IF NOT EXISTS mx_file_search_idx")
    expect(migrationSql).not.toContain("CREATE TRIGGER")
    expect(client.query.mock.calls).toContainEqual([
      "INSERT INTO mx_migration (id) VALUES ($1)",
      ["002_search_vector.sql"],
    ])
  })

  test("includes baseline seed migration", async () => {
    const { db, client } = createMockDb(["001_init.sql", "002_search_vector.sql"])

    await runMigrations(db)

    const migrationSql = client.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql): sql is string => typeof sql === "string")
      .join("\n")

    expect(migrationSql).toContain("shared/index.md")
    expect(migrationSql).toContain("users/demo_user/index.md")
    expect(migrationSql).toContain("ON CONFLICT (physical_path) DO NOTHING")
    expect(migrationSql).toContain("INSERT INTO mx_revision")
    expect(migrationSql).toContain("INSERT INTO mx_access_log")
    expect(migrationSql).not.toContain("users/index.md")
    expect(client.query.mock.calls).toContainEqual([
      "INSERT INTO mx_migration (id) VALUES ($1)",
      ["003_baseline_seed.sql"],
    ])
  })

  test("skips already-applied migrations", async () => {
    const { db, client } = createMockDb(["001_init.sql", "002_search_vector.sql", "003_baseline_seed.sql"])

    await runMigrations(db)

    expect(client.query).not.toHaveBeenCalled()
  })
})
