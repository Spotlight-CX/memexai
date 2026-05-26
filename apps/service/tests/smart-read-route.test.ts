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

describe("memory_smart_read route", () => {
  test("executes through the tool route", async () => {
    const db = createDb()
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/tools/memory_smart_read/execute",
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
  })
})
