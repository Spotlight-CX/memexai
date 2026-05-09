import type { MemexMemory } from "../client"
import { memoryToolDefinitions } from "../tool-definitions"

export type OpenAIToolDefinition = {
  type: "function"
  name: string
  description: string
  parameters: Record<string, unknown>
}

export type OpenAIToolCall = {
  name: string
  arguments: unknown
  toolCallId?: string
}

export function createOpenAITools(memory: MemexMemory) {
  return {
    definitions: memoryToolDefinitions.map((tool) => ({
      type: "function" as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    })) satisfies OpenAIToolDefinition[],

    execute: (toolCall: OpenAIToolCall) => memory.executeTool({
      name: toolCall.name,
      arguments: normalizeArguments(toolCall.arguments),
      toolCallId: toolCall.toolCallId,
    }),
  }
}

function normalizeArguments(args: unknown): unknown {
  if (typeof args !== "string") return args
  try {
    return JSON.parse(args)
  } catch {
    return args
  }
}
