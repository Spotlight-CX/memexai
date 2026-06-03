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

describe("service runMigrations", () => {
  test("skips pgvector SQL file unless vector mode is enabled", async () => {
    const { db, client } = createMockDb([
      "001_init.sql",
      "002_search_vector.sql",
      "003_baseline_seed.sql",
      "004_richer_shared_memory.sql",
      "005_dream_tables.sql",
      "006_observation_events.sql",
    ])

    await runMigrations(db)

    expect(client.query).not.toHaveBeenCalled()
  })

  test("applies pgvector SQL file when vector mode is enabled", async () => {
    const { db, client } = createMockDb([
      "001_init.sql",
      "002_search_vector.sql",
      "003_baseline_seed.sql",
      "004_richer_shared_memory.sql",
      "005_dream_tables.sql",
      "006_observation_events.sql",
    ])

    await runMigrations(db, { vectorEnabled: true })

    const migrationSql = client.query.mock.calls
      .map(([sql]) => sql)
      .filter((sql): sql is string => typeof sql === "string")
      .join("\n")

    expect(migrationSql).toContain("CREATE EXTENSION IF NOT EXISTS vector")
    expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS embedding vector(768)")
    expect(migrationSql).toContain("USING hnsw (embedding vector_cosine_ops)")
    expect(client.query.mock.calls).toContainEqual([
      "INSERT INTO mx_migration (id) VALUES ($1)",
      ["007_pgvector_embeddings.sql"],
    ])
  })
})
