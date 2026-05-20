import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { executeTool } from "./tools"
import type { Db } from "./db"
import { type ToolContext, toolDefinitions } from "@memexai/core"
import {
  listArgsSchema,
  readArgsSchema,
  writeArgsSchema,
  patchArgsSchema,
  smartReadArgsSchema,
  searchArgsSchema,
  memorizeArgsSchema,
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
  memory_smart_read: smartReadArgsSchema,
  memory_search: searchArgsSchema,
  memory_memorize: memorizeArgsSchema,
}

export function createConnectionScopedMcpServer(db: Db, ctx: ToolContext, model?: unknown): McpServer {
  const server = new McpServer({
    name: "memexai",
    version: "0.1.0",
  })

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
          const result = await executeTool(db, def.name, args, ctx, { model })
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
