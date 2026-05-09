import type { Db } from "./db"
import { HttpError } from "./errors"

type QueryResult<T> = { rows: T[] }

export async function listAdminUsers(db: Db) {
  const { rows } = await db.query<{
    user_id: string
    file_count: string
    last_write_at: Date | null
    last_read_at: Date | null
  }>(`
    SELECT
      split_part(physical_path, '/', 2) AS user_id,
      COUNT(*) AS file_count,
      MAX(updated_at) AS last_write_at,
      (
        SELECT MAX(created_at)
        FROM mx_access_log
        WHERE mx_access_log.user_id = split_part(mx_file.physical_path, '/', 2)
          AND mx_access_log.operation = 'read'
      ) AS last_read_at
    FROM mx_file
    WHERE physical_path LIKE 'users/%/%'
    GROUP BY split_part(physical_path, '/', 2)
    ORDER BY last_write_at DESC NULLS LAST, user_id ASC
  `)

  return {
    users: rows.map((row) => ({
      userId: row.user_id,
      fileCount: Number(row.file_count),
      lastWriteAt: row.last_write_at,
      lastReadAt: row.last_read_at,
    })),
  }
}

export async function listAdminFiles(db: Db, input: { prefix?: string }) {
  const prefix = input.prefix?.trim()
  const query = prefix
    ? db.query<AdminFileRow>(
        `SELECT id, physical_path, content_text, created_at, updated_at
         FROM mx_file
         WHERE physical_path = $1 OR physical_path LIKE $2
         ORDER BY physical_path ASC`,
        [prefix, `${prefix.endsWith("/") ? prefix : `${prefix}/`}%`],
      )
    : db.query<AdminFileRow>(
        `SELECT id, physical_path, content_text, created_at, updated_at
         FROM mx_file
         ORDER BY physical_path ASC`,
      )

  const { rows } = await query
  return { files: rows.map(toAdminFileSummary) }
}

export async function getAdminFile(db: Db, physicalPath: string) {
  if (!physicalPath) throw new HttpError(400, "PHYSICAL_PATH_REQUIRED", "physicalPath is required")

  const { rows } = await db.query<AdminFileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = $1`,
    [physicalPath],
  )

  const file = rows[0]
  if (!file) throw new HttpError(404, "FILE_NOT_FOUND", `File not found: ${physicalPath}`)

  return {
    file: {
      ...toAdminFileSummary(file),
      content: file.content_text,
    },
  }
}

export async function listAdminRevisions(db: Db, input: { physicalPath?: string }) {
  const query = input.physicalPath
    ? db.query<AdminRevisionRow>(
        `SELECT id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id, created_at
         FROM mx_revision
         WHERE physical_path = $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [input.physicalPath],
      )
    : db.query<AdminRevisionRow>(
        `SELECT id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id, created_at
         FROM mx_revision
         ORDER BY created_at DESC
         LIMIT 200`,
      )

  const { rows } = await query
  return {
    revisions: rows.map((row) => ({
      id: row.id,
      fileId: row.file_id,
      physicalPath: row.physical_path,
      operation: row.operation,
      content: row.content_text,
      reason: row.reason,
      actor: row.actor,
      userId: row.user_id,
      toolCallId: row.tool_call_id,
      createdAt: row.created_at,
    })),
  }
}

export async function listAdminAccessLogs(db: Db, input: { physicalPath?: string }) {
  const query = input.physicalPath
    ? db.query<AdminAccessLogRow>(
        `SELECT id, file_id, physical_path, operation, actor, user_id, tool_call_id, created_at
         FROM mx_access_log
         WHERE physical_path = $1
         ORDER BY created_at DESC
         LIMIT 300`,
        [input.physicalPath],
      )
    : db.query<AdminAccessLogRow>(
        `SELECT id, file_id, physical_path, operation, actor, user_id, tool_call_id, created_at
         FROM mx_access_log
         ORDER BY created_at DESC
         LIMIT 300`,
      )

  const { rows } = await query
  return {
    accessLogs: rows.map((row) => ({
      id: row.id,
      fileId: row.file_id,
      physicalPath: row.physical_path,
      operation: row.operation,
      actor: row.actor,
      userId: row.user_id,
      toolCallId: row.tool_call_id,
      createdAt: row.created_at,
    })),
  }
}

type AdminFileRow = {
  id: string
  physical_path: string
  content_text: string
  created_at: Date
  updated_at: Date
}

type AdminRevisionRow = {
  id: string
  file_id: string
  physical_path: string
  operation: string
  content_text: string
  reason: string | null
  actor: string | null
  user_id: string | null
  tool_call_id: string | null
  created_at: Date
}

type AdminAccessLogRow = {
  id: string
  file_id: string | null
  physical_path: string
  operation: string
  actor: string | null
  user_id: string | null
  tool_call_id: string | null
  created_at: Date
}

function toAdminFileSummary(row: AdminFileRow) {
  return {
    id: row.id,
    physicalPath: row.physical_path,
    size: row.content_text.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type AdminQuery<T> = QueryResult<T>
