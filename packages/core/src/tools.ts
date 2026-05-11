import type { Db } from "./db"
import { MemexError } from "./errors"
import { newId } from "./ids"
import { assertWritableVirtualPath, physicalToVirtual, prefixToPhysical, virtualToPhysical, type ToolContext } from "./paths"
import { appendLinesAfterHeading, replaceExactText } from "./text-patch"
import { listArgsSchema, patchArgsSchema, readArgsSchema, writeArgsSchema } from "./schemas"
import { type ToolName } from "./tool-definitions"

type FileRow = {
  id: string
  physical_path: string
  content_text: string
  created_at: Date
  updated_at: Date
}

async function logAccess(db: Db, input: {
  fileId?: string | null
  physicalPath: string
  operation: "list" | "read" | "write" | "patch"
  ctx: ToolContext
}) {
  await db.query(
    `INSERT INTO mx_access_log (id, file_id, physical_path, operation, actor, user_id, tool_call_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      newId("log"),
      input.fileId ?? null,
      input.physicalPath,
      input.operation,
      input.ctx.actor ?? null,
      input.ctx.userId,
      input.ctx.toolCallId ?? null,
    ],
  )
}

async function insertRevision(db: Db, input: {
  fileId: string
  physicalPath: string
  operation: "write" | "patch"
  content: string
  reason?: string
  ctx: ToolContext
}) {
  await db.query(
    `INSERT INTO mx_revision (id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newId("rev"),
      input.fileId,
      input.physicalPath,
      input.operation,
      input.content,
      input.reason ?? null,
      input.ctx.actor ?? null,
      input.ctx.userId,
      input.ctx.toolCallId ?? null,
    ],
  )
}

export async function executeMemoryList(db: Db, args: unknown, ctx: ToolContext) {
  const { prefix } = listArgsSchema.parse(args ?? {})
  const physicalPrefix = prefixToPhysical(prefix, ctx)
  const values: unknown[] = []
  let where = "(physical_path = 'shared' OR physical_path LIKE 'shared/%' OR physical_path LIKE $1)"
  values.push(`users/${ctx.userId}/%`)

  if (physicalPrefix) {
    where = "physical_path = $1 OR physical_path LIKE $2"
    values.length = 0
    values.push(physicalPrefix, `${physicalPrefix.endsWith("/") ? physicalPrefix : `${physicalPrefix}/`}%`)
  }

  const { rows } = await db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE ${where}
     ORDER BY physical_path ASC`,
    values,
  )

  await logAccess(db, { physicalPath: physicalPrefix ?? "*", operation: "list", ctx })

  return {
    files: rows.flatMap((row) => {
      const virtualPath = physicalToVirtual(row.physical_path, ctx)
      if (!virtualPath) return []
      return [{
        path: virtualPath,
        size: row.content_text.length,
        updatedAt: row.updated_at,
      }]
    }),
  }
}

export async function executeMemoryRead(db: Db, args: unknown, ctx: ToolContext) {
  const { path } = readArgsSchema.parse(args)
  const physicalPath = virtualToPhysical(path, ctx)
  const { rows } = await db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = $1`,
    [physicalPath],
  )

  const file = rows[0]
  if (!file) throw new MemexError("FILE_NOT_FOUND", `File not found: ${path}`)

  await logAccess(db, { fileId: file.id, physicalPath, operation: "read", ctx })

  return {
    path,
    content: file.content_text,
    updatedAt: file.updated_at,
  }
}

export async function executeMemoryWrite(db: Db, args: unknown, ctx: ToolContext) {
  const { path, content, reason } = writeArgsSchema.parse(args)
  assertWritableVirtualPath(path)
  const physicalPath = virtualToPhysical(path, ctx)

  const { rows } = await db.query<{ id: string; created: boolean }>(
    `INSERT INTO mx_file (id, physical_path, content_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (physical_path)
     DO UPDATE SET content_text = EXCLUDED.content_text, updated_at = now()
     RETURNING id, (xmax = 0) AS created`,
    [newId("file"), physicalPath, content],
  )

  const file = rows[0]
  await insertRevision(db, { fileId: file.id, physicalPath, operation: "write", content, reason, ctx })
  await logAccess(db, { fileId: file.id, physicalPath, operation: "write", ctx })

  return {
    path,
    created: file.created,
    updated: !file.created,
  }
}

export async function executeMemoryPatch(db: Db, args: unknown, ctx: ToolContext) {
  const parsed = patchArgsSchema.parse(args)
  assertWritableVirtualPath(parsed.path)
  const physicalPath = virtualToPhysical(parsed.path, ctx)

  const { rows } = await db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = $1`,
    [physicalPath],
  )
  const file = rows[0]
  if (!file) throw new MemexError("FILE_NOT_FOUND", `File not found: ${parsed.path}`)

  const result = parsed.operation === "append_lines"
    ? appendLinesAfterHeading(file.content_text, parsed.after_heading, parsed.lines)
    : replaceExactText(file.content_text, parsed.match, parsed.replacement)

  if (result.changed) {
    await db.query("UPDATE mx_file SET content_text = $1, updated_at = now() WHERE id = $2", [result.content, file.id])
    await insertRevision(db, {
      fileId: file.id,
      physicalPath,
      operation: "patch",
      content: result.content,
      reason: parsed.reason,
      ctx,
    })
  }
  await logAccess(db, { fileId: file.id, physicalPath, operation: "patch", ctx })

  return {
    path: parsed.path,
    operation: parsed.operation,
    changed: result.changed,
    noOp: !result.changed,
  }
}

export async function executeTool(db: Db, toolName: string, args: unknown, ctx: ToolContext) {
  switch (toolName as ToolName) {
    case "memory_list":
      return executeMemoryList(db, args, ctx)
    case "memory_read":
      return executeMemoryRead(db, args, ctx)
    case "memory_write":
      return executeMemoryWrite(db, args, ctx)
    case "memory_patch":
      return executeMemoryPatch(db, args, ctx)
    default:
      throw new MemexError("UNKNOWN_TOOL", `Unknown tool: ${toolName}`)
  }
}
