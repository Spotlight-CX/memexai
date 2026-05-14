import { describe, expect, test, vi } from "vitest"
import { buildServer } from "../src/server"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

describe("memory_memorize route", () => {
  test("returns MODEL_NOT_CONFIGURED when service has no model", async () => {
    const app = buildServer({ db: { query: vi.fn() } as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/tools/memory_memorize/execute",
      headers: { authorization: "Bearer agent-key" },
      payload: {
        context: { userId: "u1" },
        arguments: { text: "remember quiet neighborhoods" },
      },
    })
    await app.close()

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe("MODEL_NOT_CONFIGURED")
  })
})
