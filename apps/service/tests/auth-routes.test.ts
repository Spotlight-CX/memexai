import { describe, expect, test } from "vitest"
import { buildServer } from "../src/server"
import { createMemoryDb } from "./mcp-helpers"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
  MEMEX_SHARED_WRITE_MODE: "read_only" as const,
}

describe("auth routes", () => {
  test("rejects tool routes without bearer API key", async () => {
    const app = await buildServer({ db: {} as never, config })
    const response = await app.inject({ method: "GET", url: "/v1/tools" })
    await app.close()

    expect(response.statusCode).toBe(401)
    expect(response.json().error.code).toBe("UNAUTHORIZED")
  })

  test("allows tool routes with bearer API key", async () => {
    const app = await buildServer({ db: {} as never, config })
    const response = await app.inject({
      method: "GET",
      url: "/v1/tools",
      headers: { authorization: "Bearer agent-key" },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().tools.map((tool: { name: string }) => tool.name)).toContain("memory_write")
  })

  test("tool descriptions reflect shared writable mode", async () => {
    const app = await buildServer({ db: {} as never, config: { ...config, MEMEX_SHARED_WRITE_MODE: "rw" } })
    const response = await app.inject({
      method: "GET",
      url: "/v1/tools",
      headers: { authorization: "Bearer agent-key" },
    })
    await app.close()

    const writeTool = response.json().tools.find((tool: { name: string }) => tool.name === "memory_write")
    expect(writeTool.description).toContain("user/**` and `shared/**")
  })

  test("prompt block reflects shared writable mode", async () => {
    const { db } = createMemoryDb()
    const app = await buildServer({ db: db as never, config: { ...config, MEMEX_SHARED_WRITE_MODE: "rw" } })
    const response = await app.inject({
      method: "GET",
      url: "/v1/prompt-block?userId=writer_a",
      headers: { authorization: "Bearer agent-key" },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().promptBlock).toContain("Writable memory lives under user/** and shared/**")
    expect(response.json().promptBlock).toContain("Never store private user facts in shared/**")
  })

  test("protects admin routes with admin secret", async () => {
    const app = await buildServer({ db: {} as never, config })
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
