import { agenticToolDefinitions, memoryToolDefinitions, rawToolDefinitions } from "../tool-definitions"
import type { ToolDefinition } from "../types"

export type ToolMode = "subagent" | "agentic" | "raw" | "all"

export function selectToolDefinitions(mode: ToolMode = "subagent"): readonly ToolDefinition[] {
  if (mode === "raw") return rawToolDefinitions
  if (mode === "all") return memoryToolDefinitions
  return agenticToolDefinitions
}
