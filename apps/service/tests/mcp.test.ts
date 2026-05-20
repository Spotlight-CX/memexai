import { describe, expect, test, vi } from "vitest"
import { buildServer } from "../src/server"
import { activeMcpSessions } from "../src/mcp"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

function createDb() {
  return {
    query: vi.fn(async () => ({ rows: [] })),
  }
}

describe("MCP Routes", () => {
  test("returns 401 on /v1/mcp/sse without auth", async () => {
    const db = createDb()
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "GET",
      url: "/v1/mcp/sse",
    })
    await app.close()

    expect(response.statusCode).toBe(401)
  })

  test("returns 401 on /v1/mcp/messages without auth", async () => {
    const db = createDb()
    const app = buildServer({ db: db as never, config })

    const response = await app.inject({
      method: "POST",
      url: "/v1/mcp/messages",
    })
    await app.close()

    expect(response.statusCode).toBe(401)
  })

  test("returns 404 on /v1/mcp/messages with valid auth but unknown connectionId", async () => {
    const db = createDb()
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

  test("successfully initializes SSE and handles messages", async () => {
    const db = createDb()
    const app = buildServer({ db: db as never, config })

    // We do NOT await the SSE response promise yet, as it will stay open.
    const ssePromise = app.inject({
      method: "GET",
      url: "/v1/mcp/sse?apiKey=agent-key&userId=user_test",
    })

    // Wait for the session to be registered in activeMcpSessions
    let connectionId = ""
    for (let i = 0; i < 50; i++) {
      for (const [id, session] of activeMcpSessions.entries()) {
        if (session.userId === "user_test") {
          connectionId = id
          break
        }
      }
      if (connectionId) break
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    expect(connectionId).not.toBe("")

    const session = activeMcpSessions.get(connectionId)
    expect(session).toBeDefined()

    // Mock handlePostMessage so we don't need real client-server handshake/negotiation
    session!.transport.handlePostMessage = vi.fn(async (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
    })

    // Simulate client sending a post message
    const msgResponse = await app.inject({
      method: "POST",
      url: `/v1/mcp/messages?connectionId=${connectionId}&apiKey=agent-key`,
      payload: { jsonrpc: "2.0", method: "tools/list", id: 1 },
    })

    expect(msgResponse.statusCode).toBe(200)
    expect(msgResponse.json()).toEqual({ ok: true })
    expect(session!.transport.handlePostMessage).toHaveBeenCalled()

    // Close the SSE transport to end the streaming connection, resolving ssePromise
    await session!.transport.close()

    const sseResponse = await ssePromise
    expect(sseResponse.statusCode).toBe(200)
    expect(sseResponse.headers["content-type"]).toBe("text/event-stream")

    await app.close()
  })
})
