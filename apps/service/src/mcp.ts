import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { executeTool } from "./tools"
import type { Db } from "./db"
import { getToolDefinitions, resolveMemoryPermissions, type EmbeddingConfig, type MemoryPermissions, type ToolContext } from "@memexai/core"
import {
  listArgsSchema,
  readArgsSchema,
  writeArgsSchema,
  patchArgsSchema,
  contextArgsSchema,
  findArgsSchema,
  rememberArgsSchema,
} from "./schemas"
import type { z } from "zod"

export interface McpSession {
  server: McpServer
  transport: SSEServerTransport
  userId: string
  actor?: string
}

export const activeMcpSessions = new Map<string, McpSession>()

const schemaMap: Record<string, z.ZodTypeAny> = {
  memory_list: listArgsSchema,
  memory_read: readArgsSchema,
  memory_write: writeArgsSchema,
  memory_patch: patchArgsSchema,
  memory_context: contextArgsSchema,
  memory_find: findArgsSchema,
  memory_remember: rememberArgsSchema,
}

export function createConnectionScopedMcpServer(
  db: Db,
  ctx: ToolContext,
  options: EmbeddingConfig & {
    model?: unknown
    permissions?: MemoryPermissions
    rrfK?: number
    bm25CandidateLimit?: number
    vectorCandidateLimit?: number
  } = {},
): McpServer {
  const server = new McpServer({
    name: "memexai",
    version: "0.1.0",
  })
  const toolDefinitions = getToolDefinitions(options.permissions ?? resolveMemoryPermissions())

  for (const def of toolDefinitions) {
    const schema = schemaMap[def.name]
    if (!schema) {
      continue
    }

    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: schema as any,
      },
      async (args) => {
        try {
          const result = await executeTool(db, def.name, args, ctx, options)
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          }
        } catch (error: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: error?.message || String(error),
              },
            ],
          }
        }
      }
    )
  }

  return server
}
