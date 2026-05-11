import type { Memex, MemexUser } from "../memex"
import type { ToolContext } from "../paths"
import { toolDefinitions } from "../tool-definitions"

type AnthropicTool = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export function createAnthropicTools(target: Memex | MemexUser, ctx?: ToolContext): AnthropicTool[] {
  return toolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Record<string, unknown>,
  }))
}

export async function handleAnthropicToolCall(
  toolName: string,
  toolInput: unknown,
  target: Memex | MemexUser,
  ctx?: ToolContext,
  toolUseId?: string,
): Promise<unknown> {
  if ("executeTool" in target && ctx === undefined) {
    return (target as MemexUser).executeTool(toolName, toolInput, toolUseId)
  }
  const memex = target as Memex
  const context = ctx!
  return memex.executeTool(
    toolName,
    toolInput,
    toolUseId ? { ...context, toolCallId: toolUseId } : context,
  )
}
