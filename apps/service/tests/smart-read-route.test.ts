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
          id: "file_profile",
          physical_path: "users/u1/profile.md",
          content_text: "# Profile",
          created_at: new Date("2026-05-14T12:00:00.000Z"),
          updated_at: new Date("2026-05-14T12:00:00.000Z"),
        }],
      }
    }),
  }
}

describe("memory_context route", () => {
  test("executes through the tool route", async () => {
    const db = createDb()
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/tools/memory_context/execute",
      headers: { authorization: "Bearer agent-key" },
      payload: {
        context: { userId: "u1" },
        arguments: { maxChars: 1000, includeRelated: false, relatedDepth: 0 },
      },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().filesIncluded).toEqual(["user/profile.md"])
    expect(response.json().content).toContain("## user/profile.md")
    const observationCall = db.query.mock.calls.find(([sql, values]) => (
      String(sql).includes("mx_observation_event") && (values as unknown[] | undefined)?.[1] === "tool_execution"
    ))
    expect(observationCall?.[1]).toEqual(expect.arrayContaining([
      "tool_execution",
      "success",
      "u1",
      "memory_context",
      "context",
    ]))
    expect(JSON.parse(String(observationCall?.[1]?.at(-1)))).toMatchObject({
      files_included: 1,
      files_omitted: 0,
      truncated: false,
    })
  })
})
