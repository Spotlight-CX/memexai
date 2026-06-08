export { createMemex, Memex, MemexUser } from "./memex"
export { MemexError } from "./errors"
export { createPool } from "./db"
export { runMigrations } from "./migrations"
export { agenticToolDefinitions, memorySubagentToolDefinitions, rawToolDefinitions, toolDefinitions } from "./tool-definitions"
export { getAgenticToolDefinitions, getMemorySubagentToolDefinitions, getRawToolDefinitions, getToolDefinitions } from "./tool-definitions"
export { executeTool, executeMemoryConsolidate } from "./tools"
export { readDreamConfig, resetStaleDreamRuns, runDreamCycle, selectUsersToDream, triggerUserDream } from "./dream-scheduler"
export { resolveMemoryPermissions } from "./paths"
export { currentObservationScope, recordObservationEvent, sanitizeObservationAttributes } from "./observability"
export type { MemoryPermissions, SharedWriteMode, ToolContext } from "./paths"
export type { ObservationEventInput, ObservationSearchStats, ObservationUsage } from "./observability"
export type { ToolDefinition, ToolName } from "./tool-definitions"
export type { DreamConfig, DreamCycleResult, UserDreamResult } from "./dream-scheduler"
export type { Db } from "./db"
export type { EmbeddingAdapter, EmbeddingConfig, EmbeddingStrategy, SearchMatchReason } from "@memexai/search"
export {
  listAdminUsers,
  listAdminFiles,
  getAdminFile,
  writeAdminFile,
  listAdminRevisions,
  pruneAdminRevisions,
  getRevisionAtOffset,
  listAdminAccessLogs,
  listAdminDreamUsers,
  getMemorySnapshot,
  getAgenticTrace,
  listAgenticTraceSession,
  getAdminSetupStatus,
  writeAdminSetupComplete,
} from "./admin"
