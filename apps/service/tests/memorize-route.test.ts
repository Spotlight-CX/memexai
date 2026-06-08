import { describe, expect, test, vi } from "vitest"
import { buildServer } from "../src/server"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

describe("memory_remember route", () => {
  test("returns MODEL_NOT_CONFIGURED when service has no model", async () => {
    const db = { query: vi.fn(async () => ({ rows: [] })) }
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/tools/memory_remember/execute",
      headers: { authorization: "Bearer agent-key" },
      payload: {
        context: { userId: "u1" },
        arguments: { text: "remember quiet neighborhoods" },
      },
    })
    await app.close()

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe("MODEL_NOT_CONFIGURED")
    const observationCall = db.query.mock.calls.find(([sql]) => String(sql).includes("mx_observation_event"))
    expect(observationCall?.[1]).toEqual(expect.arrayContaining([
      "tool_execution",
      "error",
      "u1",
      "memory_remember",
      "remember",
      "MODEL_NOT_CONFIGURED",
    ]))
  })
})
