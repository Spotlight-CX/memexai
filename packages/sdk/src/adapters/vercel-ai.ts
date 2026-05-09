import type { MemexMemory } from "../client"
import { memoryToolDefinitions } from "../tool-definitions"

type VercelAITool = {
  description: string
  parameters: Record<string, unknown>
  execute: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>
}

export function createVercelAITools(memory: MemexMemory): Record<string, VercelAITool> {
  return Object.fromEntries(
    memoryToolDefinitions.map((tool) => [
      tool.name,
      {
        description: tool.description,
        parameters: tool.inputSchema,
        execute: (args: unknown, options?: { toolCallId?: string }) => memory.executeTool({
          name: tool.name,
          arguments: args,
          toolCallId: options?.toolCallId,
        }),
      },
    ]),
  )
}
