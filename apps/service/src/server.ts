import Fastify, { type FastifyInstance } from "fastify"
import { ZodError } from "zod"
import { requireAdminSecret, requireApiKey } from "./auth"
import type { Config } from "./config"
import type { Db } from "./db"
import { errorResponse, HttpError } from "./errors"
import { buildPromptBlock } from "./prompt-block"
import { executeToolRequestSchema, promptBlockQuerySchema } from "./schemas"
import { executeTool, listTools } from "./tools"

export function buildServer(input: { db: Db; config: Config }): FastifyInstance {
  const app = Fastify({ logger: true })
  const { db, config } = input
  const apiAuth = requireApiKey(config.MEMEX_API_KEY)
  const adminAuth = requireAdminSecret(config.MEMEX_ADMIN_SECRET)

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

  app.get("/v1/tools", { preHandler: apiAuth }, async () => listTools())

  app.post("/v1/tools/:toolName/execute", { preHandler: apiAuth }, async (request) => {
    const params = request.params as { toolName?: string }
    if (!params.toolName) {
      throw new HttpError(400, "TOOL_NAME_REQUIRED", "toolName is required")
    }

    const body = executeToolRequestSchema.parse(request.body)
    return executeTool(db, params.toolName, body.arguments, body.context)
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

  return app
}
