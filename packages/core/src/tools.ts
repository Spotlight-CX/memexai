import type { Db } from "./db"
import { MemexError } from "./errors"
import { newId } from "./ids"
import { assertWritableVirtualPath, physicalToVirtual, prefixToPhysical, virtualToPhysical, type ToolContext } from "./paths"
import { appendLinesAfterHeading, replaceExactText } from "./text-patch"
import { listArgsSchema, patchArgsSchema, readArgsSchema, searchArgsSchema, smartReadArgsSchema, writeArgsSchema } from "./schemas"
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
  operation: "list" | "read" | "write" | "patch" | "smart_read" | "search"
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

type SmartReadRow = FileRow & {
  rank?: number
}

function buildMemoryBlock(input: {
  included: { path: string; content: string; updatedAt: Date }[]
  omitted: string[]
}): string {
  const sections = input.included.map((file) => [
    `## ${file.path}`,
    `(updated ${file.updatedAt.toISOString()})`,
    "",
    file.content,
  ].join("\n"))

  const note = input.omitted.length > 0
    ? [
      "---",
      `Note: ${input.omitted.length} file(s) omitted (budget limit). Use memory_search to find specific content.`,
    ].join("\n")
    : null

  return [
    "<memexai_memory>",
    ...sections,
    note,
    "</memexai_memory>",
  ].filter(Boolean).join("\n\n")
}

export async function executeMemorySmartRead(db: Db, args: unknown, ctx: ToolContext) {
  const { maxChars = 24_000, query } = smartReadArgsSchema.parse(args ?? {})
  const values: unknown[] = [`users/${ctx.userId}/%`]
  let sql = `
    SELECT id, physical_path, content_text, created_at, updated_at
    FROM mx_file
    WHERE physical_path LIKE $1 OR physical_path LIKE 'shared/%'
    ORDER BY updated_at DESC
  `

  if (query) {
    values.unshift(query)
    sql = `
      WITH q AS (SELECT plainto_tsquery('english', $1) AS query)
      SELECT id, physical_path, content_text, created_at, updated_at, ts_rank_cd(search_vector, q.query) AS rank
      FROM mx_file, q
      WHERE (physical_path LIKE $2 OR physical_path LIKE 'shared/%')
        AND search_vector @@ q.query
      ORDER BY rank DESC, updated_at DESC
    `
  }

  const { rows } = await db.query<SmartReadRow>(sql, values)
  const visibleFiles = rows.flatMap((row) => {
    const path = physicalToVirtual(row.physical_path, ctx)
    return path ? [{ path, content: row.content_text, updatedAt: row.updated_at }] : []
  })

  const included: { path: string; content: string; updatedAt: Date }[] = []
  const omitted: string[] = []
  let usedChars = 0

  for (const file of visibleFiles) {
    const sectionChars = file.path.length + file.content.length + 64
    if (usedChars + sectionChars <= maxChars || included.length === 0) {
      if (sectionChars <= maxChars || included.length === 0) {
        included.push(file)
        usedChars += sectionChars
        continue
      }
    }
    omitted.push(file.path)
  }

  await logAccess(db, { physicalPath: "*", operation: "smart_read", ctx })

  return {
    content: buildMemoryBlock({ included, omitted }),
    filesIncluded: included.map((file) => file.path),
    filesOmitted: omitted,
    truncated: omitted.length > 0,
  }
}

type SearchRow = {
  physical_path: string
  snippet: string
  rank: number
  updated_at: Date
}

export async function executeMemorySearch(db: Db, args: unknown, ctx: ToolContext) {
  const { query, limit = 10, prefix } = searchArgsSchema.parse(args)
  const values: unknown[] = [query]
  let visibilityWhere = "(physical_path LIKE $2 OR physical_path LIKE 'shared/%')"
  values.push(`users/${ctx.userId}/%`)

  if (prefix) {
    const physicalPrefix = prefixToPhysical(prefix, ctx)
    visibilityWhere = "(physical_path = $2 OR physical_path LIKE $3)"
    values.length = 1
    values.push(physicalPrefix, `${physicalPrefix.endsWith("/") ? physicalPrefix : `${physicalPrefix}/`}%`)
  }
  values.push(limit)

  const { rows } = await db.query<SearchRow>(
    `
      WITH q AS (SELECT plainto_tsquery('english', $1) AS query)
      SELECT
        physical_path,
        ts_headline('english', content_text, q.query, 'MaxFragments=2, MinWords=4, MaxWords=24') AS snippet,
        ts_rank_cd(search_vector, q.query) AS rank,
        updated_at
      FROM mx_file, q
      WHERE ${visibilityWhere}
        AND search_vector @@ q.query
      ORDER BY rank DESC, updated_at DESC
      LIMIT $${values.length}
    `,
    values,
  )

  await logAccess(db, { physicalPath: prefix ? prefixToPhysical(prefix, ctx) : "*", operation: "search", ctx })

  return {
    query,
    results: rows.flatMap((row) => {
      const path = physicalToVirtual(row.physical_path, ctx)
      if (!path) return []
      return [{
        path,
        snippet: row.snippet,
        rank: Number(row.rank),
        updatedAt: row.updated_at,
      }]
    }),
    truncated: false,
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
    case "memory_smart_read":
      return executeMemorySmartRead(db, args, ctx)
    case "memory_search":
      return executeMemorySearch(db, args, ctx)
    default:
      throw new MemexError("UNKNOWN_TOOL", `Unknown tool: ${toolName}`)
  }
}
