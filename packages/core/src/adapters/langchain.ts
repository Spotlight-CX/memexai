import type { Memex, MemexUser } from "../memex"
import type { ToolContext } from "../paths"
import { toolDefinitions } from "../tool-definitions"

export type LangChainStructuredToolLike = {
  name: string
  description: string
  schema: Record<string, unknown>
  call: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>
}

export function createLangChainTools(
  target: Memex | MemexUser,
  ctx?: ToolContext,
): LangChainStructuredToolLike[] {
  return toolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema as Record<string, unknown>,
    call: (args: unknown, options?: { toolCallId?: string }) => {
      if ("executeTool" in target && ctx === undefined) {
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
  }))
}
