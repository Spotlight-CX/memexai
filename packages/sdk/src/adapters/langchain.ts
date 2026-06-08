import type { MemexMemory } from "../client"
import { selectToolDefinitions, type ToolMode } from "./shared"

export type LangChainStructuredToolLike = {
  name: string
  description: string
  schema: Record<string, unknown>
  call: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>
}

export function createLangChainTools(memory: MemexMemory, options: { mode?: ToolMode } = {}): LangChainStructuredToolLike[] {
  return selectToolDefinitions(options.mode).map((tool) => ({
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema,
    call: (args: unknown, options?: { toolCallId?: string }) => memory.executeTool({
      name: tool.name,
      arguments: args,
      toolCallId: options?.toolCallId,
    }),
  }))
}

export async function createLangChainToolsFromService(memory: MemexMemory, options: { mode?: ToolMode } = {}): Promise<LangChainStructuredToolLike[]> {
  const definitions = options.mode === "all" ? await memory.getToolDefinitions() : selectToolDefinitions(options.mode)

  return definitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema,
    call: (args: unknown, options?: { toolCallId?: string }) => memory.executeTool({
      name: tool.name,
      arguments: args,
      toolCallId: options?.toolCallId,
    }),
  }))
}
