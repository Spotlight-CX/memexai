import type { MemexMemory } from "../client"
import { selectToolDefinitions, type ToolMode } from "./shared"

export type OpenAIToolDefinition = {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type OpenAIToolCall = {
  name: string
  arguments: unknown
  toolCallId?: string
}

export function createOpenAITools(memory: MemexMemory, options: { mode?: ToolMode } = {}) {
  return {
    definitions: selectToolDefinitions(options.mode).map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    })) satisfies OpenAIToolDefinition[],

    execute: (toolCall: OpenAIToolCall) => memory.executeTool({
      name: toolCall.name,
      arguments: normalizeArguments(toolCall.arguments),
      toolCallId: toolCall.toolCallId,
    }),
  }
}

export async function createOpenAIToolsFromService(memory: MemexMemory, options: { mode?: ToolMode } = {}) {
  const definitions = options.mode === "all"
    ? await memory.getToolDefinitions()
    : selectToolDefinitions(options.mode)

  return {
    definitions: definitions.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
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
