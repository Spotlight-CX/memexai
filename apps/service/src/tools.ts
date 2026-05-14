import {
  executeTool as executeCoreTool,
  MemexError,
  toolDefinitions,
  type ToolContext,
} from "@memexai/core"
import type { Db } from "./db"
import { HttpError } from "./errors"

export async function executeTool(
  db: Db,
  toolName: string,
  args: unknown,
  ctx: ToolContext,
  options: { model?: unknown } = {},
) {
  try {
    return await executeCoreTool(db, toolName, args, ctx, options)
  } catch (error) {
    if (error instanceof MemexError) {
      throw new HttpError(statusForMemexError(error.code), error.code, error.message)
    }
    throw error
  }
}

export function listTools() {
  return { tools: toolDefinitions }
}

function statusForMemexError(code: string): number {
  switch (code) {
    case "FILE_NOT_FOUND":
    case "UNKNOWN_TOOL":
      return 404
    default:
      return 400
  }
}
