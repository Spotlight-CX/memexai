import { describe, expect, test, vi } from "vitest"
import { buildServer } from "../src/server"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

describe("memory_context route", () => {
  test("returns MODEL_NOT_CONFIGURED when service has no model", async () => {
    const db = { query: vi.fn(async () => ({ rows: [] })) }
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/tools/memory_context/execute",
      headers: { authorization: "Bearer agent-key" },
      payload: {
        context: { userId: "u1" },
        arguments: { maxChars: 1000 },
      },
    })
    await app.close()

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe("MODEL_NOT_CONFIGURED")
    const observationCall = db.query.mock.calls.find(([sql, values]) => (
      String(sql).includes("mx_observation_event") && (values as unknown[] | undefined)?.[1] === "tool_execution"
    ))
    expect(observationCall?.[1]).toEqual(expect.arrayContaining([
      "tool_execution",
      "error",
      "u1",
      "memory_context",
      "context",
      "MODEL_NOT_CONFIGURED",
    ]))
  })
})
