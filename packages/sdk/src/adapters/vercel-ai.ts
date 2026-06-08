import type { MemexMemory } from "../client"

type ToolMode = "subagent" | "agentic" | "raw"

export function createVercelAITools(memory: MemexMemory, options: { mode?: ToolMode } = {}) {
  return options.mode === "raw" ? memory.createRawToolset() : memory.createMemorySubagentToolset()
}

export async function createVercelAIToolsFromService(memory: MemexMemory, options: { mode?: ToolMode } = {}) {
  return options.mode === "raw" ? memory.createRawToolsetFromService() : memory.createMemorySubagentToolsetFromService()
}
