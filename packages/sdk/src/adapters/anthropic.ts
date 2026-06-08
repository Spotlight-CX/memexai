import type { MemexMemory } from "../client"
import { selectToolDefinitions, type ToolMode } from "./shared"

export type AnthropicTool = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export function createAnthropicTools(memory: MemexMemory, options: { mode?: ToolMode } = {}): AnthropicTool[] {
  return selectToolDefinitions(options.mode).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }))
}

export async function createAnthropicToolsFromService(memory: MemexMemory, options: { mode?: ToolMode } = {}): Promise<AnthropicTool[]> {
  const definitions = options.mode === "all" ? await memory.getToolDefinitions() : selectToolDefinitions(options.mode)
  return definitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }))
}

export async function handleAnthropicToolCall(
  toolName: string,
  toolInput: unknown,
  memory: MemexMemory,
  toolUseId?: string,
): Promise<unknown> {
  return memory.executeTool({
    name: toolName,
    arguments: toolInput,
    toolCallId: toolUseId,
  })
}
