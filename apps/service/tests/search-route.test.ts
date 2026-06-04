import { describe, expect, test, vi } from "vitest"
import { buildServer } from "../src/server"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

function createDb() {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("mx_observation_event")) return { rows: [] }
      if (sql.includes("mx_access_log")) return { rows: [] }
      return {
        rows: [{
          physical_path: "users/u1/profile.md",
          snippet: "quiet neighborhood",
          rank: 0.4,
          updated_at: new Date("2026-05-14T12:00:00.000Z"),
        }],
      }
    }),
  }
}

describe("memory_search route", () => {
  test("executes through the tool route", async () => {
    const db = createDb()
    const app = await buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/tools/memory_search/execute",
      headers: { authorization: "Bearer agent-key" },
      payload: {
        context: { userId: "u1" },
        arguments: { query: "neighborhood" },
      },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().results).toMatchObject([
      { path: "user/profile.md", snippet: "quiet neighborhood", rank: 0.4 },
    ])
    const observationCall = db.query.mock.calls.find(([sql]) => String(sql).includes("mx_observation_event"))
    expect(observationCall).toBeTruthy()
    expect(observationCall?.[1]).toEqual(expect.arrayContaining([
      "tool_execution",
      "success",
      "u1",
      "memory_search",
      "search",
    ]))
    expect(String(observationCall?.[1])).not.toContain("neighborhood")
  })
})
