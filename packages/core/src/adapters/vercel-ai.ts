import { jsonSchema } from "ai"
import type { Memex, MemexUser } from "../memex"
import type { ToolContext } from "../paths"
import { toolDefinitions } from "../tool-definitions"

type VercelAITool = {
  description: string
  inputSchema: ReturnType<typeof jsonSchema>
  execute: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>
}

export function createVercelAITools(
  target: Memex | MemexUser,
  ctx?: ToolContext,
): Record<string, VercelAITool> {
  return Object.fromEntries(
    toolDefinitions.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonSchema(tool.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: (args: unknown, options?: { toolCallId?: string }) => {
          if ("executeTool" in target && typeof (target as MemexUser).executeTool === "function") {
            return (target as MemexUser).executeTool(tool.name, args, options?.toolCallId)
          }
          const memex = target as Memex
          const context = ctx!
          return memex.executeTool(
            tool.name,
            args,
            options?.toolCallId ? { ...context, toolCallId: options.toolCallId } : context,
          )
        },
      },
    ]),
  )
}
