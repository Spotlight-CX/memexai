import { describe, expect, test } from "vitest"
import { buildServer } from "../src/server"
import { createMemoryDb } from "./mcp-helpers"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

describe("memory_patch route", () => {
  test("append_lines can append to EOF without after_heading", async () => {
    const { db, files } = createMemoryDb([
      {
        id: "file_1",
        physical_path: "users/u1/log.md",
        content_text: "- existing log\n",
        created_at: new Date("2026-05-20T09:00:00.000Z"),
        updated_at: new Date("2026-05-20T09:00:00.000Z"),
      },
    ])
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/tools/memory_patch/execute",
      headers: { authorization: "Bearer agent-key" },
      payload: {
        context: { userId: "u1" },
        arguments: {
          path: "user/log.md",
          operation: "append_lines",
          lines: ["- [2026-05-22] wrote user/profile.md - User likes cars."],
          reason: "Log memory operation.",
        },
      },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      path: "user/log.md",
      operation: "append_lines",
      changed: true,
      noOp: false,
    })
    expect(files.get("users/u1/log.md")?.content_text).toBe("- existing log\n- [2026-05-22] wrote user/profile.md - User likes cars.\n")
  })
})
