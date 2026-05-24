import Fastify, { type FastifyInstance } from "fastify"
import { ZodError } from "zod"
import { getAdminFile, listAdminAccessLogs, listAdminFiles, listAdminRevisions, listAdminUsers, writeAdminFile } from "./admin"
import { handleConfigureChat } from "./admin-configure"
import { handleSetupGenerate } from "./admin-setup"
import { requireAdminSecret, requireApiKey } from "./auth"
import type { Config } from "./config"
import type { Db } from "./db"
import { errorResponse, HttpError } from "./errors"
import { buildPromptBlock } from "./prompt-block"
import { executeToolRequestSchema, promptBlockQuerySchema } from "./schemas"
import { executeTool, listTools } from "./tools"
import { registerAdminStaticRoutes } from "./static-admin"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { newId } from "./ids"
import { activeMcpSessions, createConnectionScopedMcpServer } from "./mcp"

export function buildServer(input: { db: Db; config: Config; model?: unknown }): FastifyInstance {
  const app = Fastify({ logger: true })
  const { db, config } = input
  const apiAuth = requireApiKey(config.MEMEX_API_KEY)
  const adminAuth = requireAdminSecret(config.MEMEX_ADMIN_SECRET)

  const mcpAuth = async (request: any) => {
    const authHeader = request.headers.authorization
    if (authHeader === `Bearer ${config.MEMEX_API_KEY}`) {
      return
    }
    const query = request.query as { apiKey?: string; token?: string }
    if (query.apiKey === config.MEMEX_API_KEY || query.token === config.MEMEX_API_KEY) {
      return
    }
    throw new HttpError(401, "UNAUTHORIZED", "Missing or invalid API key")
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          issues: error.issues,
        },
      })
    }

    const response = errorResponse(error)
    return reply.status(response.statusCode).send(response.body)
  })

  app.get("/health", async () => ({ ok: true }))

  app.get("/v1/mcp/sse", { preHandler: mcpAuth }, async (request, reply) => {
    const query = request.query as { userId?: string; actor?: string }
    const userId = query.userId || "default"
    const actor = query.actor || "mcp-client"

    const connectionId = newId("conn")
    const transport = new SSEServerTransport(`/v1/mcp/messages?connectionId=${connectionId}`, reply.raw)

    const ctx = { userId, actor }
    const mcpServer = createConnectionScopedMcpServer(db, ctx, input.model)

    await mcpServer.connect(transport)

    activeMcpSessions.set(connectionId, {
      server: mcpServer,
      transport,
      userId,
      actor,
    })

    request.raw.on("close", () => {
      activeMcpSessions.delete(connectionId)
      transport.close().catch(() => {})
    })

    reply.hijack()
  })

  app.post("/v1/mcp/messages", { preHandler: mcpAuth }, async (request, reply) => {
    const query = request.query as { connectionId?: string }
    const connectionId = query.connectionId

    if (!connectionId) {
      throw new HttpError(400, "CONNECTION_ID_REQUIRED", "connectionId query parameter is required")
    }

    const session = activeMcpSessions.get(connectionId)
    if (!session) {
      throw new HttpError(404, "SESSION_NOT_FOUND", "MCP session not found")
    }

    await session.transport.handlePostMessage(request.raw, reply.raw, request.body)
    reply.hijack()
  })

  app.get("/v1/tools", { preHandler: apiAuth }, async () => listTools())

  app.post("/v1/tools/:toolName/execute", { preHandler: apiAuth }, async (request) => {
    const params = request.params as { toolName?: string }
    if (!params.toolName) {
      throw new HttpError(400, "TOOL_NAME_REQUIRED", "toolName is required")
    }

    const body = executeToolRequestSchema.parse(request.body)
    return executeTool(db, params.toolName, body.arguments, body.context, { model: input.model })
  })

  app.get("/v1/prompt-block", { preHandler: apiAuth }, async (request) => {
    const context = promptBlockQuerySchema.parse(request.query)
    return { promptBlock: await buildPromptBlock(db, context) }
  })

  app.post("/v1/prompt-block", { preHandler: apiAuth }, async (request) => {
    const body = executeToolRequestSchema.pick({ context: true }).parse(request.body)
    return { promptBlock: await buildPromptBlock(db, body.context) }
  })

  app.get("/v1/admin/health", { preHandler: adminAuth }, async () => ({ ok: true, admin: true }))
  app.get("/v1/admin/users", { preHandler: adminAuth }, async () => listAdminUsers(db))
  app.get("/v1/admin/files", { preHandler: adminAuth }, async (request) => {
    const query = request.query as { prefix?: string }
    return listAdminFiles(db, { prefix: query.prefix })
  })
  app.get("/v1/admin/files/*", { preHandler: adminAuth }, async (request) => {
    const params = request.params as { "*": string }
    return getAdminFile(db, decodeURIComponent(params["*"]))
  })
  app.put("/v1/admin/files/*", { preHandler: adminAuth }, async (request) => {
    const params = request.params as { "*": string }
    const { content, reason } = request.body as { content: string; reason?: string }
    return writeAdminFile(db, decodeURIComponent(params["*"]), content, reason)
  })
  app.get("/v1/admin/revisions", { preHandler: adminAuth }, async (request) => {
    const query = request.query as { physicalPath?: string }
    return listAdminRevisions(db, { physicalPath: query.physicalPath })
  })
  app.get("/v1/admin/access-logs", { preHandler: adminAuth }, async (request) => {
    const query = request.query as { physicalPath?: string }
    return listAdminAccessLogs(db, { physicalPath: query.physicalPath })
  })

  app.post("/v1/admin/setup-generate", { preHandler: adminAuth }, async (request) => {
    const { productDescription, domain, userInfoCategories, extra } = request.body as {
      productDescription: string
      domain: string
      userInfoCategories: string[]
      extra?: string
    }
    return handleSetupGenerate({ productDescription, domain, userInfoCategories, extra })
  })

  app.post("/v1/admin/configure-chat", { preHandler: adminAuth }, async (request) => {
    const { message, history } = request.body as {
      message: string
      history?: Array<{ role: string; content: string }>
    }
    return handleConfigureChat(db, input.model, { message, history: (history ?? []) as Array<{ role: "user" | "assistant"; content: string }> })
  })

  registerAdminStaticRoutes(app)

  return app
}
