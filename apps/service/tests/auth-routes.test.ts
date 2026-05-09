import { describe, expect, test } from "vitest"
import { buildServer } from "../src/server"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

describe("auth routes", () => {
  test("rejects tool routes without bearer API key", async () => {
    const app = buildServer({ db: {} as never, config })
    const response = await app.inject({ method: "GET", url: "/v1/tools" })
    await app.close()

    expect(response.statusCode).toBe(401)
    expect(response.json().error.code).toBe("UNAUTHORIZED")
  })

  test("allows tool routes with bearer API key", async () => {
    const app = buildServer({ db: {} as never, config })
    const response = await app.inject({
      method: "GET",
      url: "/v1/tools",
      headers: { authorization: "Bearer agent-key" },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().tools.map((tool: { name: string }) => tool.name)).toContain("memory_write")
  })

  test("protects admin routes with admin secret", async () => {
    const app = buildServer({ db: {} as never, config })
    const unauthorized = await app.inject({ method: "GET", url: "/v1/admin/health" })
    const authorized = await app.inject({
      method: "GET",
      url: "/v1/admin/health",
      headers: { "x-memex-admin-secret": "admin-secret" },
    })
    await app.close()

    expect(unauthorized.statusCode).toBe(401)
    expect(authorized.statusCode).toBe(200)
  })
})
