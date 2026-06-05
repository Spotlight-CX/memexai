import Fastify, { type FastifyInstance } from "fastify"
import swagger from "@fastify/swagger"
import { ZodError } from "zod"
import { getAdminFile, listAdminAccessLogs, listAdminDreamUsers, listAdminFiles, listAdminRevisions, listAdminUsers, pruneAdminRevisions, writeAdminFile } from "./admin"
import { getDoc, listDocs } from "./docs"
import { handleConfigureChat } from "./admin-configure"
import {
  getFileObservability,
  getObservabilitySummary,
  getObservabilitySchemaSignals,
  getObservabilityTimeseries,
  getObservabilityTree,
  getObservabilityTreeNode,
  getUserMemoryObservability,
  listObservabilityEvents,
  listObservabilityTopFiles,
  recordObservationEvent,
  type ObservabilityFilters,
} from "./admin-observability"
import { handleSetupGenerate } from "./admin-setup"
import { requireAdminSecret, requireApiKey } from "./auth"
import type { Config } from "./config"
import type { Db } from "./db"
import { errorResponse, HttpError } from "./errors"
import { buildPromptBlock } from "./prompt-block"
import { executeToolRequestSchema, promptBlockQuerySchema } from "./schemas"
import { searchStatus, type SearchRuntime } from "./search-config"
import { executeTool, listTools } from "./tools"
import { registerAdminStaticRoutes } from "./static-admin"
import { countBucket, createNoopTelemetry, durationBucket, type TelemetryClient } from "./telemetry"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { newId } from "./ids"
import { activeMcpSessions, createConnectionScopedMcpServer } from "./mcp"
import { readDreamConfig, resolveMemoryPermissions, runDreamCycle, triggerUserDream } from "@memexai/core"

export function buildServer(input: { db: Db; config: Config; model?: unknown; telemetry?: TelemetryClient; search?: SearchRuntime }): FastifyInstance {
  const app = Fastify({ logger: true })
  const { db, config } = input
  const searchRuntime = input.search
  const memoryPermissions = resolveMemoryPermissions({ sharedWriteMode: config.MEMEX_SHARED_WRITE_MODE })
  const embeddingOptions = () => searchRuntime?.mode === "hybrid" ? searchRuntime.embedding : undefined
  const telemetry = input.telemetry ?? createNoopTelemetry()
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

  app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "MemexAI Admin API",
        description: "Admin API for inspecting and managing MemexAI agent memory. All /v1/admin/* routes require x-memex-admin-secret header. All /v1/* agent routes require Authorization: Bearer <key>.",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          adminSecret: { type: "apiKey", in: "header", name: "x-memex-admin-secret" },
          agentKey: { type: "http", scheme: "bearer" },
        },
      },
      tags: [
        { name: "admin-users", description: "User management" },
        { name: "admin-files", description: "Memory file management" },
        { name: "admin-revisions", description: "Revision history and time-travel" },
        { name: "admin-logs", description: "Access log inspection" },
        { name: "admin-dream", description: "Dream cycle management" },
        { name: "admin-observability", description: "Observability and analytics" },
        { name: "admin-setup", description: "Memory bootstrap and setup" },
        { name: "agent-tools", description: "Agent memory tools" },
        { name: "health", description: "Health checks" },
      ],
    },
  })

  // Expose spec at /v1/openapi.json (admin auth)
  app.get("/v1/openapi.json", { preHandler: adminAuth }, async () => app.swagger())

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

  app.addHook("onResponse", (request, reply, done) => {
    const group = adminRouteGroup(request.url)
    if (group) {
      telemetry.capture("admin_route_used", {
        admin_route_group: group,
        success: reply.statusCode < 400,
      })
    }
    done()
  })

  app.get("/health", async () => ({ ok: true }))

  app.get("/v1/mcp/sse", { preHandler: mcpAuth }, async (request, reply) => {
    const query = request.query as { userId?: string; actor?: string }
    const userId = query.userId || "default"
    const actor = query.actor || "mcp-client"

    const connectionId = newId("conn")
    const transport = new SSEServerTransport(`/v1/mcp/messages?connectionId=${connectionId}`, reply.raw)

    const ctx = { userId, actor }
    const mcpServer = createConnectionScopedMcpServer(db, ctx, {
      model: input.model,
      permissions: memoryPermissions,
      ...embeddingOptions(),
      rrfK: searchRuntime?.rrfK,
      bm25CandidateLimit: searchRuntime?.bm25CandidateLimit,
      vectorCandidateLimit: searchRuntime?.vectorCandidateLimit,
    })

    await mcpServer.connect(transport)
    telemetry.capture("mcp_session_started", { transport: "sse" })

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

  app.get("/v1/tools", { preHandler: apiAuth }, async () => listTools(memoryPermissions))

  app.post("/v1/tools/:toolName/execute", { preHandler: apiAuth }, async (request) => {
    const started = Date.now()
    const params = request.params as { toolName?: string }
    if (!params.toolName) {
      throw new HttpError(400, "TOOL_NAME_REQUIRED", "toolName is required")
    }

    try {
      const body = executeToolRequestSchema.parse(request.body)
      const result = await executeTool(db, params.toolName, body.arguments, body.context, {
        model: input.model,
        permissions: memoryPermissions,
        ...embeddingOptions(),
        rrfK: searchRuntime?.rrfK,
        bm25CandidateLimit: searchRuntime?.bm25CandidateLimit,
        vectorCandidateLimit: searchRuntime?.vectorCandidateLimit,
      })
      telemetry.capture("tool_executed", {
        tool_name: params.toolName,
        success: true,
        duration_bucket: durationBucket(Date.now() - started),
      })
      return result
    } catch (error) {
      telemetry.capture("tool_executed", {
        tool_name: params.toolName,
        success: false,
        error_code: errorCode(error),
        duration_bucket: durationBucket(Date.now() - started),
      })
      throw error
    }
  })

  app.get("/v1/prompt-block", { preHandler: apiAuth }, async (request) => {
    const started = Date.now()
    let context: { userId?: string; actor?: string } | undefined
    try {
      context = promptBlockQuerySchema.parse(request.query)
      const result = { promptBlock: await buildPromptBlock(db, context, memoryPermissions) }
      await recordObservationEvent(db, {
        eventType: "prompt_block",
        status: "success",
        durationMs: Date.now() - started,
        userId: context.userId,
        actor: context.actor,
        attributes: { route_kind: "get" },
      })
      telemetry.capture("prompt_block_requested", { route_kind: "get", success: true, duration_bucket: durationBucket(Date.now() - started) })
      return result
    } catch (error) {
      await recordObservationEvent(db, {
        eventType: "prompt_block",
        status: "error",
        durationMs: Date.now() - started,
        userId: context?.userId,
        actor: context?.actor,
        errorCode: errorCode(error),
        attributes: { route_kind: "get" },
      })
      telemetry.capture("prompt_block_requested", { route_kind: "get", success: false, error_code: errorCode(error), duration_bucket: durationBucket(Date.now() - started) })
      throw error
    }
  })

  app.post("/v1/prompt-block", { preHandler: apiAuth }, async (request) => {
    const started = Date.now()
    let context: { userId?: string; actor?: string } | undefined
    try {
      const body = executeToolRequestSchema.pick({ context: true }).parse(request.body)
      context = body.context
      const result = { promptBlock: await buildPromptBlock(db, body.context, memoryPermissions) }
      await recordObservationEvent(db, {
        eventType: "prompt_block",
        status: "success",
        durationMs: Date.now() - started,
        userId: body.context.userId,
        actor: body.context.actor,
        attributes: { route_kind: "post" },
      })
      telemetry.capture("prompt_block_requested", { route_kind: "post", success: true, duration_bucket: durationBucket(Date.now() - started) })
      return result
    } catch (error) {
      await recordObservationEvent(db, {
        eventType: "prompt_block",
        status: "error",
        durationMs: Date.now() - started,
        userId: context?.userId,
        actor: context?.actor,
        errorCode: errorCode(error),
        attributes: { route_kind: "post" },
      })
      telemetry.capture("prompt_block_requested", { route_kind: "post", success: false, error_code: errorCode(error), duration_bucket: durationBucket(Date.now() - started) })
      throw error
    }
  })

  app.get("/v1/admin/health", { preHandler: adminAuth, schema: { tags: ["health"], summary: "Admin health check" } }, async () => ({ ok: true, admin: true }))
  app.get("/v1/admin/search/status", { preHandler: adminAuth }, async () => {
    return searchRuntime
      ? searchStatus(searchRuntime)
      : { mode: "bm25", provider: null, model: null, dimensions: null }
  })
  app.get("/v1/admin/users", {
    preHandler: adminAuth,
    schema: {
      tags: ["admin-users"],
      summary: "List all users with file counts and activity timestamps",
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", description: "Filter by userId substring (case-insensitive)" },
          limit: { type: "integer", minimum: 1, maximum: 200, description: "Max results (default 50)" },
        },
      },
    },
  }, async (request) => {
    const query = request.query as { q?: string; limit?: string }
    const limit = query.limit ? Number(query.limit) : undefined
    return listAdminUsers(db, { q: query.q, limit })
  })
  app.get("/v1/admin/files", {
    preHandler: adminAuth,
    schema: {
      tags: ["admin-files"],
      summary: "List memory files",
      querystring: {
        type: "object",
        properties: {
          prefix: { type: "string", description: "Filter by path prefix (e.g. shared/ or users/alice/)" },
          asOf: { type: "string", description: "Return file state at this UTC ISO timestamp (time-travel)" },
        },
      },
    },
  }, async (request) => {
    const query = request.query as { prefix?: string; asOf?: string }
    return listAdminFiles(db, { prefix: query.prefix, asOf: parseAsOf(query.asOf) })
  })
  app.get("/v1/admin/files/:physicalPath/observability", { preHandler: adminAuth }, async (request) => {
    const params = request.params as { physicalPath: string }
    const query = request.query as { bucket?: string }
    return getFileObservability(db, decodeURIComponent(params.physicalPath), { bucket: query.bucket })
  })
  app.get("/v1/admin/files/*", {
    preHandler: adminAuth,
    schema: {
      tags: ["admin-files"],
      summary: "Get a memory file by physical path",
      description: "Returns full content, metadata, latest revision info, and revision count",
    },
  }, async (request) => {
    const params = request.params as { "*": string }
    const query = request.query as { asOf?: string }
    return getAdminFile(db, decodeURIComponent(params["*"]), {
      asOf: parseAsOf(query.asOf),
      embedding: embeddingOptions(),
      includeEmbedding: searchRuntime?.mode === "hybrid",
    })
  })
  app.put("/v1/admin/files/*", {
    preHandler: adminAuth,
    schema: {
      tags: ["admin-files"],
      summary: "Write or overwrite a memory file",
      body: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", description: "File content (Markdown)" },
          reason: { type: "string", description: "Reason for write (stored in revision history)" },
        },
      },
    },
  }, async (request) => {
    const params = request.params as { "*": string }
    const { content, reason } = request.body as { content: string; reason?: string }
    return writeAdminFile(db, decodeURIComponent(params["*"]), content, reason, embeddingOptions())
  })
  app.get("/v1/admin/revisions", {
    preHandler: adminAuth,
    schema: {
      tags: ["admin-revisions"],
      summary: "List revision history",
      description: "Full write audit trail. Use physicalPath to get time-travel snapshots. tool_call_id links to access logs for agentic tracing.",
      querystring: {
        type: "object",
        properties: {
          physicalPath: { type: "string", description: "Filter by exact physical path" },
          userId: { type: "string", description: "Filter by userId" },
          actor: { type: "string", description: "Filter by actor (e.g. dream-agent, admin)" },
          from: { type: "string", format: "date-time", description: "Start timestamp (ISO 8601)" },
          to: { type: "string", format: "date-time", description: "End timestamp (ISO 8601)" },
          limit: { type: "integer", minimum: 1 },
          offset: { type: "integer", minimum: 0 },
        },
      },
    },
  }, async (request) => {
    const query = request.query as {
      physicalPath?: string
      actor?: string
      userId?: string
      from?: string
      to?: string
      limit?: string
      offset?: string
    }
    return listAdminRevisions(db, {
      physicalPath: query.physicalPath,
      actor: query.actor,
      userId: query.userId,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    })
  })
  app.post("/v1/admin/revisions/prune", { preHandler: adminAuth }, async (request) => {
    const { olderThanDays } = (request.body ?? {}) as { olderThanDays?: number }
    return pruneAdminRevisions(db, { olderThanDays: Number(olderThanDays) })
  })
  app.get("/v1/admin/access-logs", {
    preHandler: adminAuth,
    schema: {
      tags: ["admin-logs"],
      summary: "List access logs (reads and writes)",
      description: "Every memory tool call is logged here. Use toolCallId to correlate with revisions for agentic tracing.",
      querystring: {
        type: "object",
        properties: {
          physicalPath: { type: "string", description: "Filter by exact physical path" },
          userId: { type: "string" },
          toolCallId: { type: "string", description: "Filter by tool call ID for agentic tracing" },
          from: { type: "string", format: "date-time" },
          to: { type: "string", format: "date-time" },
          limit: { type: "integer", minimum: 1, maximum: 500 },
          offset: { type: "integer", minimum: 0 },
        },
      },
    },
  }, async (request) => {
    const query = request.query as {
      physicalPath?: string
      userId?: string
      toolCallId?: string
      from?: string
      to?: string
      limit?: string
      offset?: string
    }
    return listAdminAccessLogs(db, {
      physicalPath: query.physicalPath,
      userId: query.userId,
      toolCallId: query.toolCallId,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    })
  })
  app.get("/v1/admin/observability/summary", { preHandler: adminAuth }, async (request) => {
    return getObservabilitySummary(db, parseObservabilityQuery(request.query))
  })
  app.get("/v1/admin/observability/timeseries", { preHandler: adminAuth }, async (request) => {
    return getObservabilityTimeseries(db, parseObservabilityQuery(request.query))
  })
  app.get("/v1/admin/observability/top-files", { preHandler: adminAuth }, async (request) => {
    return listObservabilityTopFiles(db, parseObservabilityQuery(request.query))
  })
  app.get("/v1/admin/observability/tree", { preHandler: adminAuth }, async (request) => {
    return getObservabilityTree(db, parseObservabilityQuery(request.query))
  })
  app.get("/v1/admin/observability/tree-node", { preHandler: adminAuth }, async (request) => {
    const query = request.query as { path?: string }
    if (!query.path) {
      throw new HttpError(400, "PATH_REQUIRED", "path is required")
    }
    return getObservabilityTreeNode(db, query.path, parseObservabilityQuery(request.query))
  })
  app.get("/v1/admin/observability/events", { preHandler: adminAuth }, async (request) => {
    return listObservabilityEvents(db, parseObservabilityQuery(request.query))
  })
  app.get("/v1/admin/observability/schema-signals", { preHandler: adminAuth }, async (request) => {
    return getObservabilitySchemaSignals(db, parseObservabilityQuery(request.query))
  })
  app.get("/v1/admin/observability/user", { preHandler: adminAuth }, async (request) => {
    return getUserMemoryObservability(db, parseObservabilityQuery(request.query))
  })
  app.get("/v1/admin/dream/config", { preHandler: adminAuth }, async () => {
    const { rows } = await db.query<{ key: string; value: string; description: string | null; updated_at: Date }>(
      "SELECT key, value, description, updated_at FROM mx_config WHERE key LIKE 'dream_%' ORDER BY key ASC",
    )
    return {
      config: Object.fromEntries(rows.map((row) => [row.key, row.value])),
      rows: rows.map((row) => ({
        key: row.key,
        value: row.value,
        description: row.description,
        updatedAt: row.updated_at,
      })),
    }
  })
  app.put("/v1/admin/dream/config", { preHandler: adminAuth }, async (request) => {
    const body = request.body as { config?: Record<string, unknown> }
    const entries = Object.entries(body.config ?? {})
      .filter(([key]) => key.startsWith("dream_"))
      .map(([key, value]) => [key, String(value)] as const)

    for (const [key, value] of entries) {
      await db.query(
        `
          INSERT INTO mx_config (key, value, updated_at)
          VALUES ($1, $2, now())
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        `,
        [key, value],
      )
    }

    return { updated: entries.map(([key]) => key) }
  })
  app.get("/v1/admin/dream/users", { preHandler: adminAuth }, async (request) => {
    const query = request.query as {
      status?: string
      q?: string
      from?: string
      to?: string
      limit?: string
      offset?: string
    }
    return listAdminDreamUsers(db, {
      status: query.status,
      q: query.q,
      from: query.from,
      to: query.to,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    })
  })
  app.put("/v1/admin/dream/users/:userId/paused", { preHandler: adminAuth }, async (request) => {
    const params = request.params as { userId?: string }
    const body = request.body as { paused?: boolean }
    if (!params.userId) {
      throw new HttpError(400, "USER_ID_REQUIRED", "userId is required")
    }
    if (typeof body.paused !== "boolean") {
      throw new HttpError(400, "VALIDATION_ERROR", "paused must be a boolean")
    }

    const { rows } = await db.query<{
      user_id: string
      status: string
      paused: boolean
      updated_at: Date
    }>(
      `
        INSERT INTO mx_dream_run (id, user_id, paused, status)
        VALUES ($1, $2, $3, 'idle')
        ON CONFLICT (user_id)
        DO UPDATE SET paused = EXCLUDED.paused, updated_at = now()
        RETURNING user_id, status, paused, updated_at
      `,
      [newId("dream"), params.userId, body.paused],
    )
    const row = rows[0]
    return {
      user: {
        userId: row.user_id,
        status: row.status,
        paused: row.paused,
        updatedAt: row.updated_at,
      },
    }
  })

  app.post("/v1/admin/dream/run", { preHandler: adminAuth }, async (request, reply) => {
    if (!input.model) {
      throw new HttpError(503, "MODEL_NOT_CONFIGURED", "No LLM model configured — set GEMINI_API_KEY or equivalent")
    }
    const body = request.body as { userId?: string }
    const dreamConfig = await readDreamConfig(db)

    if (body.userId) {
      void triggerUserDream(db, body.userId, dreamConfig, { model: input.model }).then((result) => {
        telemetry.capture("dream_cycle_run", {
          status: result.filesTouched === 0 ? "noop" : "updated",
          files_touched_bucket: countBucket(result.filesTouched),
        })
      }).catch((err: unknown) => {
        telemetry.capture("dream_cycle_run", { status: "error", error_code: errorCode(err) })
        console.error("Admin dream trigger failed for user", body.userId, err)
      })
      reply.code(202)
      return { started: true, userId: body.userId }
    }

    void runDreamCycle(db, { ...dreamConfig, enabled: true }, { model: input.model }).then((result) => {
      telemetry.capture("dream_cycle_run", {
        status: result.status,
        files_touched_bucket: countBucket(result.filesTouched),
      })
    }).catch((err: unknown) => {
      telemetry.capture("dream_cycle_run", { status: "error", error_code: errorCode(err) })
      console.error("Admin dream trigger failed (global)", err)
    })
    reply.code(202)
    return { started: true }
  })

  app.post("/v1/admin/setup-generate", { preHandler: adminAuth }, async (request) => {
    const { productDescription, domain, memorableExample, neverStore, forgettingProblem, stability, includeTimestamps, extra, revisionInstruction } = request.body as {
      productDescription: string
      domain: string
      memorableExample?: string
      neverStore?: string
      forgettingProblem?: string
      stability?: string
      includeTimestamps?: boolean
      extra?: string
      revisionInstruction?: string
    }
    return handleSetupGenerate(input.model, { productDescription, domain, memorableExample, neverStore, forgettingProblem, stability, includeTimestamps, extra, revisionInstruction })
  })

  app.post("/v1/admin/configure-chat", { preHandler: adminAuth }, async (request) => {
    const { message, history } = request.body as {
      message: string
      history?: Array<{ role: string; content: string }>
    }
    return handleConfigureChat(db, input.model, { message, history: (history ?? []) as Array<{ role: "user" | "assistant"; content: string }> })
  })

  // Public docs endpoint — no auth required
  app.get("/v1/docs", async () => listDocs())
  app.get("/v1/docs/*", async (request) => {
    const params = request.params as { "*": string }
    return getDoc(decodeURIComponent(params["*"]))
  })

  registerAdminStaticRoutes(app)

  return app
}

function errorCode(error: unknown): string {
  if (error instanceof HttpError) return error.code
  if (error instanceof ZodError) return "VALIDATION_ERROR"
  if (error instanceof Error) return error.name || "ERROR"
  return "ERROR"
}

function adminRouteGroup(url: string): string | null {
  if (!url.startsWith("/v1/admin/")) return null
  if (url.startsWith("/v1/admin/dream/")) return "dreams"
  if (url.startsWith("/v1/admin/search")) return "search"
  if (url.startsWith("/v1/admin/observability")) return "observability"
  if (url.startsWith("/v1/admin/files")) return "files"
  if (url.startsWith("/v1/admin/revisions")) return "revisions"
  if (url.startsWith("/v1/admin/access-logs")) return "access_logs"
  if (url.startsWith("/v1/admin/users")) return "users"
  if (url.startsWith("/v1/admin/setup-generate")) return "setup"
  if (url.startsWith("/v1/admin/configure-chat")) return "configure"
  if (url.startsWith("/v1/admin/health")) return "health"
  return "other"
}

function parseObservabilityQuery(query: unknown): ObservabilityFilters {
  const input = query as Record<string, string | undefined>
  return {
    from: input.from,
    to: input.to,
    userId: input.userId,
    normalizedPath: input.normalizedPath ?? input.path,
    physicalPath: input.physicalPath,
    toolName: input.toolName,
    operation: input.operation,
    status: input.status,
    actor: input.actor,
    bucket: input.bucket,
    limit: input.limit ? Number(input.limit) : undefined,
    offset: input.offset ? Number(input.offset) : undefined,
  }
}

function parseAsOf(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    throw new HttpError(400, "INVALID_AS_OF", "asOf must be a valid UTC ISO timestamp")
  }
  return date
}
