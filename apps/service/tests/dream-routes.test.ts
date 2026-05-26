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
      if (sql.includes("FROM mx_dream_run")) {
        return {
          rows: [{
            user_id: "u1",
            status: "completed",
            paused: false,
            last_dreamed_at: new Date("2026-05-26T08:00:00Z"),
            last_started_at: new Date("2026-05-26T07:59:00Z"),
            files_touched: 2,
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
    const response = await app.inject({ method: "GET", url: "/v1/admin/dream/users", headers: adminHeaders })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().users[0]).toMatchObject({ userId: "u1", status: "completed", dreamCount: 1 })
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
