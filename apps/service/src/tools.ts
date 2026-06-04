import {
  executeTool as executeCoreTool,
  getToolDefinitions,
  MemexError,
  resolveMemoryPermissions,
  type EmbeddingConfig,
  type MemoryPermissions,
  type SharedWriteMode,
  type ToolContext,
} from "@memexai/core"
import type { Db } from "./db"
import { HttpError } from "./errors"

export async function executeTool(
  db: Db,
  toolName: string,
  args: unknown,
  ctx: ToolContext,
  options: EmbeddingConfig & {
    model?: unknown
    permissions?: MemoryPermissions
    sharedWriteMode?: SharedWriteMode
    rrfK?: number
    bm25CandidateLimit?: number
    vectorCandidateLimit?: number
  } = {},
) {
  try {
    const permissions = options.permissions ?? resolveMemoryPermissions({ sharedWriteMode: options.sharedWriteMode })
    return await executeCoreTool(db, toolName, args, ctx, { ...options, permissions })
  } catch (error) {
    if (error instanceof MemexError) {
      throw new HttpError(statusForMemexError(error.code), error.code, error.message)
    }
    throw error
  }
}

export function listTools(permissions: MemoryPermissions = resolveMemoryPermissions()) {
  return { tools: getToolDefinitions(permissions) }
}

function statusForMemexError(code: string): number {
  switch (code) {
    case "FILE_NOT_FOUND":
    case "UNKNOWN_TOOL":
      return 404
    case "READ_ONLY_MOUNT":
      return 403
    default:
      return 400
  }
}
