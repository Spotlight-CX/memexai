import { afterEach, describe, expect, test } from "vitest"
import { buildServer } from "../src/server"
import { activeMcpSessions } from "../src/mcp"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { createMemoryDb } from "./mcp-helpers"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

async function listenOnRandomPort(app: ReturnType<typeof buildServer>) {
  const address = await app.listen({ port: 0, host: "127.0.0.1" })
  return new URL(address)
}

afterEach(async () => {
  for (const session of activeMcpSessions.values()) {
    await session.transport.close().catch(() => {})
  }
  activeMcpSessions.clear()
})

describe("MCP Routes", () => {
  test("returns 401 on /v1/mcp/sse without auth", async () => {
    const { db } = createMemoryDb()
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "GET",
      url: "/v1/mcp/sse",
    })
    await app.close()

    expect(response.statusCode).toBe(401)
  })

  test("returns 401 on /v1/mcp/messages without auth", async () => {
    const { db } = createMemoryDb()
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/mcp/messages",
    })
    await app.close()

    expect(response.statusCode).toBe(401)
  })

  test("returns 400 on /v1/mcp/messages without connectionId", async () => {
    const { db } = createMemoryDb()
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/mcp/messages",
      headers: { authorization: "Bearer agent-key" },
      payload: {},
    })
    await app.close()

    expect(response.statusCode).toBe(400)
    expect(response.json().error.code).toBe("CONNECTION_ID_REQUIRED")
  })

  test("returns 404 on /v1/mcp/messages with valid auth but unknown connectionId", async () => {
    const { db } = createMemoryDb()
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/mcp/messages?connectionId=conn_nonexistent",
      headers: { authorization: "Bearer agent-key" },
      payload: {},
    })
    await app.close()

    expect(response.statusCode).toBe(404)
  })

  test("lists and calls tools over real MCP SSE transport", async () => {
    const { db, files } = createMemoryDb()
    const app = buildServer({ db: db as never, config })
    const baseUrl = await listenOnRandomPort(app)
    const client = new Client({ name: "memexai-test", version: "0.1.0" })
    const transport = new SSEClientTransport(new URL("/v1/mcp/sse?apiKey=agent-key&userId=user_test&actor=tester", baseUrl), {
      requestInit: {
        headers: { authorization: "Bearer agent-key" },
      },
    })

    try {
      await client.connect(transport)

      const tools = await client.listTools()
      expect(tools.tools.map((tool) => tool.name)).toContain("memory_write")

      const result = await client.callTool({
        name: "memory_write",
        arguments: {
          path: "user/profile.md",
          content: "# Profile\n- Likes reliable tests",
          reason: "MCP SSE integration test",
        },
      })

      expect(result.isError).toBeFalsy()
      expect(result.content[0]).toMatchObject({ type: "text" })
      expect(JSON.parse(result.content[0].text)).toEqual({
        path: "user/profile.md",
        created: true,
        updated: false,
      })
      expect(files.get("users/user_test/profile.md")?.content_text).toContain("reliable tests")
    } finally {
      await client.close()
      await app.close()
    }
  })

  test("removes active SSE sessions when the client closes", async () => {
    const { db } = createMemoryDb()
    const app = buildServer({ db: db as never, config })
    const baseUrl = await listenOnRandomPort(app)
    const client = new Client({ name: "memexai-test", version: "0.1.0" })
    const transport = new SSEClientTransport(new URL("/v1/mcp/sse?apiKey=agent-key&userId=user_cleanup", baseUrl), {
      requestInit: {
        headers: { authorization: "Bearer agent-key" },
      },
    })

    try {
      await client.connect(transport)
      expect([...activeMcpSessions.values()].some((session) => session.userId === "user_cleanup")).toBe(true)

      await client.close()
      for (let i = 0; i < 50; i++) {
        if (![...activeMcpSessions.values()].some((session) => session.userId === "user_cleanup")) break
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      expect([...activeMcpSessions.values()].some((session) => session.userId === "user_cleanup")).toBe(false)
    } finally {
      await app.close()
    }
  })

  test("lists and calls tools over stdio MCP transport", async () => {
    const client = new Client({ name: "memexai-stdio-test", version: "0.1.0" })
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["apps/service/tests/stdio-mcp-fixture.ts"],
      cwd: process.cwd(),
      stderr: "pipe",
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
      },
    })

    try {
      await client.connect(transport)

      const tools = await client.listTools()
      expect(tools.tools.map((tool) => tool.name)).toContain("memory_write")

      const result = await client.callTool({
        name: "memory_write",
        arguments: {
          path: "user/stdio.md",
          content: "# Stdio\n- works",
          reason: "MCP stdio integration test",
        },
      })

      expect(result.isError).toBeFalsy()
      expect(JSON.parse(result.content[0].text)).toEqual({
        path: "user/stdio.md",
        created: true,
        updated: false,
      })
    } finally {
      await client.close()
    }
  })
})
