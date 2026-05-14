import type { MemexMemory } from "../client"

export function createVercelAITools(memory: MemexMemory, options: { mode?: "agentic" | "raw" } = {}) {
  return options.mode === "raw" ? memory.createRawToolset() : memory.createAgenticToolset()
}
