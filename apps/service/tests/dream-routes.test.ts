import { describe, expect, test, vi } from "vitest"
import { buildServer } from "../src/server"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
  MEMEX_DREAM_ENABLED: false,
}

const adminHeaders = { "x-memex-admin-secret": "admin-secret" }

function createDreamDb() {
  return {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("FROM mx_config")) {
        return {
          rows: [
            { key: "dream_enabled", value: "false", description: "Master switch", updated_at: new Date("2026-05-26T08:00:00Z") },
            { key: "dream_interval_minutes", value: "60", description: "Interval", updated_at: new Date("2026-05-26T08:00:00Z") },
          ],
        }
      }
      if (sql.includes("COUNT(*) AS total") && sql.includes("FROM mx_dream_run")) {
        return { rows: [{ total: "2" }] }
      }
      if (sql.includes("COUNT(*) FILTER") && sql.includes("FROM mx_dream_run")) {
        return { rows: [{ running: "1", failed: "1", completed: "0", paused: "1" }] }
      }
      if (sql.includes("SELECT user_id, status, paused")) {
        return {
          rows: [{
            user_id: "u1",
            status: "running",
            paused: false,
            last_dreamed_at: new Date("2026-05-26T08:00:00Z"),
            last_started_at: new Date("2026-05-26T07:59:00Z"),
            files_touched: null,
            error: null,
            dream_count: 1,
            updated_at: new Date("2026-05-26T08:00:00Z"),
          }],
        }
      }
      if (sql.includes("RETURNING user_id, status, paused, updated_at")) {
        return {
          rows: [{
            user_id: values?.[1],
            status: "idle",
            paused: values?.[2],
            updated_at: new Date("2026-05-26T08:00:00Z"),
          }],
        }
      }
      return { rows: [] }
    }),
  }
}

describe("dream admin routes", () => {
  test("gets dream config", async () => {
    const app = buildServer({ db: createDreamDb() as never, config })
    const response = await app.inject({ method: "GET", url: "/v1/admin/dream/config", headers: adminHeaders })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().config).toMatchObject({ dream_enabled: "false", dream_interval_minutes: "60" })
  })

  test("updates dream config", async () => {
    const db = createDreamDb()
    const app = buildServer({ db: db as never, config })
    const response = await app.inject({
      method: "PUT",
      url: "/v1/admin/dream/config",
      headers: adminHeaders,
      payload: { config: { dream_interval_minutes: 15, ignored: "x" } },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().updated).toEqual(["dream_interval_minutes"])
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO mx_config"), ["dream_interval_minutes", "15"])
  })

  test("lists dream users", async () => {
    const app = buildServer({ db: createDreamDb() as never, config })
    const response = await app.inject({ method: "GET", url: "/v1/admin/dream/users?status=running&q=u&from=2026-05-26T00%3A00%3A00.000Z&limit=500&offset=25", headers: adminHeaders })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().users[0]).toMatchObject({ userId: "u1", status: "running", dreamCount: 1 })
    expect(response.json().summary).toMatchObject({ running: 1, failed: 1, completed: 0, paused: 1 })
    expect(response.json().pagination).toMatchObject({ limit: 200, offset: 25, total: 2, hasMore: false })
  })

  test("toggles user paused flag", async () => {
    const app = buildServer({ db: createDreamDb() as never, config })
    const response = await app.inject({
      method: "PUT",
      url: "/v1/admin/dream/users/u1/paused",
      headers: adminHeaders,
      payload: { paused: true },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().user).toMatchObject({ userId: "u1", paused: true })
  })
})
