import type { MemexMemory } from "../client"
import { memoryToolDefinitions } from "../tool-definitions"

export type LangChainStructuredToolLike = {
  name: string
  description: string
  schema: Record<string, unknown>
  call: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>
}

export function createLangChainTools(memory: MemexMemory): LangChainStructuredToolLike[] {
  return memoryToolDefinitions.map((tool) => ({
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
