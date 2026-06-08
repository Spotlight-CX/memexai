import type { MemexMemory } from "../client"
import { selectToolDefinitions, type ToolMode } from "./shared"

export function createVercelAITools(memory: MemexMemory, options: { mode?: ToolMode } = {}) {
  if (options.mode === "raw") return memory.createRawToolset()
  if (options.mode === "all") return memory.createToolsetFromDefinitions(selectToolDefinitions("all"))
  return memory.createMemorySubagentToolset()
}

export async function createVercelAIToolsFromService(memory: MemexMemory, options: { mode?: ToolMode } = {}) {
  if (options.mode === "raw") return memory.createRawToolsetFromService()
  if (options.mode === "all") return memory.createToolsetFromDefinitions(await memory.getToolDefinitions())
  return memory.createMemorySubagentToolsetFromService()
}
