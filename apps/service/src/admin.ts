import type { Db } from "./db"
import { HttpError } from "./errors"
import { newId } from "./ids"
import { SearchError, contentHash, prepareFileEmbedding, storePreparedEmbedding, type EmbeddingConfig } from "@memexai/search"

type QueryResult<T> = { rows: T[] }
const DREAM_STATUSES = new Set(["idle", "running", "completed", "failed"])

export async function listAdminUsers(db: Db, input: { q?: string; limit?: number } = {}) {
  const q = input.q?.trim()
  const limit = input.limit && Number.isFinite(input.limit)
    ? Math.min(Math.max(Math.trunc(input.limit), 1), 200)
    : null
  const values: unknown[] = []
  const filters: string[] = []

  if (q) {
    values.push(`%${q.toLowerCase()}%`)
    filters.push(`lower(user_files.user_id) LIKE $${values.length}`)
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""
  const limitSql = limit ? `LIMIT $${values.push(limit)}` : ""

  const { rows } = await db.query<{
    user_id: string
    file_count: string
    last_write_at: Date | null
    last_read_at: Date | null
  }>(
    `
    WITH user_files AS (
      SELECT
        split_part(physical_path, '/', 2) AS user_id,
        COUNT(*) AS file_count,
        MAX(updated_at) AS last_write_at
      FROM mx_file
      WHERE physical_path LIKE 'users/%/%'
      GROUP BY split_part(physical_path, '/', 2)
    ),
    user_reads AS (
      SELECT
        user_id,
        MAX(created_at) AS last_read_at
      FROM mx_access_log
      WHERE operation = 'read'
        AND user_id IS NOT NULL
      GROUP BY user_id
    )
    SELECT
      user_files.user_id,
      user_files.file_count,
      user_files.last_write_at,
      user_reads.last_read_at
    FROM user_files
    LEFT JOIN user_reads ON user_reads.user_id = user_files.user_id
    ${where}
    ORDER BY user_files.last_write_at DESC NULLS LAST, user_files.user_id ASC
    ${limitSql}
  `,
    values,
  )

  return {
    users: rows.map((row) => ({
      userId: row.user_id,
      fileCount: Number(row.file_count),
      lastWriteAt: row.last_write_at,
      lastReadAt: row.last_read_at,
    })),
  }
}

export async function listAdminFiles(db: Db, input: { prefix?: string; asOf?: Date }) {
  const prefix = input.prefix?.trim()
  if (input.asOf) {
    const values: unknown[] = [input.asOf]
    const filters = ["created_at <= $1"]
    if (prefix) {
      values.push(prefix, `${prefix.endsWith("/") ? prefix : `${prefix}/`}%`)
      filters.push(`(physical_path = $${values.length - 1} OR physical_path LIKE $${values.length})`)
    }
    const { rows } = await db.query<AdminRevisionFileRow>(
      `SELECT DISTINCT ON (physical_path)
         id, file_id, physical_path, content_text, created_at, operation, actor, reason, user_id, tool_call_id
       FROM mx_revision
       WHERE ${filters.join(" AND ")}
       ORDER BY physical_path ASC, created_at DESC, id DESC`,
      values,
    )
    return { files: rows.map(toHistoricalAdminFileSummary) }
  }

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

export async function getAdminFile(db: Db, physicalPath: string, input: { asOf?: Date; includeEmbedding?: boolean; embedding?: EmbeddingConfig } = {}) {
  if (!physicalPath) throw new HttpError(400, "PHYSICAL_PATH_REQUIRED", "physicalPath is required")

  if (input.asOf) {
    const { rows } = await db.query<AdminRevisionFileRow>(
      `SELECT id, file_id, physical_path, content_text, created_at, operation, actor, reason, user_id, tool_call_id
       FROM mx_revision
       WHERE physical_path = $1 AND created_at <= $2
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [physicalPath, input.asOf],
    )

    const revision = rows[0]
    if (!revision) throw new HttpError(404, "FILE_NOT_FOUND", `File not found at selected timestamp: ${physicalPath}`)

    return {
      file: {
        ...toHistoricalAdminFileSummary(revision),
        content: revision.content_text,
        latestRevision: toRevisionMeta(revision),
        matchedRevision: toMatchedRevisionMeta(revision),
        revisionCount: 1,
      },
    }
  }

  const embeddingSelect = input.includeEmbedding
    ? `f.embedding_model, f.embedding_dimensions, f.embedding_strategy,
       f.embedding_chunk_count, f.embedding_content_hash, f.embedding_updated_at,`
    : `NULL::text AS embedding_model, NULL::integer AS embedding_dimensions,
       NULL::text AS embedding_strategy, NULL::integer AS embedding_chunk_count,
       NULL::text AS embedding_content_hash, NULL::timestamptz AS embedding_updated_at,`

  const { rows } = await db.query<AdminFileRow & {
    latest_op: string | null
    latest_actor: string | null
    latest_reason: string | null
    latest_rev_at: Date | null
    revision_count: string
  }>(
    `SELECT
       f.id, f.physical_path, f.content_text, f.created_at, f.updated_at,
       ${embeddingSelect}
       r.operation AS latest_op, r.actor AS latest_actor,
       r.reason AS latest_reason, r.created_at AS latest_rev_at,
       (SELECT COUNT(*) FROM mx_revision WHERE file_id = f.id) AS revision_count
     FROM mx_file f
     LEFT JOIN LATERAL (
       SELECT operation, actor, reason, created_at
       FROM mx_revision
       WHERE file_id = f.id
       ORDER BY created_at DESC
       LIMIT 1
     ) r ON true
     WHERE f.physical_path = $1`,
    [physicalPath],
  )

  const file = rows[0]
  if (!file) throw new HttpError(404, "FILE_NOT_FOUND", `File not found: ${physicalPath}`)

  return {
    file: {
        ...toAdminFileSummary(file, input.includeEmbedding ? input.embedding : undefined),
      content: file.content_text,
      latestRevision: file.latest_op
        ? {
            operation: file.latest_op,
            actor: file.latest_actor,
            reason: file.latest_reason,
            createdAt: file.latest_rev_at,
          }
        : null,
      revisionCount: Number(file.revision_count),
    },
  }
}

export async function listAdminRevisions(db: Db, input: {
  physicalPath?: string
  actor?: string
  userId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
} = {}) {
  const values: unknown[] = []
  const filters: string[] = []
  const limit = clampInt(input.limit, 200, 1, 200)
  const offset = clampInt(input.offset, 0, 0, 100_000)

  if (input.physicalPath) {
    values.push(input.physicalPath)
    filters.push(`physical_path = $${values.length}`)
  }
  if (input.actor) {
    values.push(input.actor)
    filters.push(`actor = $${values.length}`)
  }
  if (input.userId) {
    values.push(input.userId)
    filters.push(`user_id = $${values.length}`)
  }
  addDateFilter(filters, values, "created_at", ">=", input.from)
  addDateFilter(filters, values, "created_at", "<=", input.to)

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""
  const totalValues = [...values]
  const { rows: countRows } = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM mx_revision ${where}`,
    totalValues,
  )
  values.push(limit, offset)
  const { rows } = await db.query<AdminRevisionRow>(
    `SELECT id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id, created_at
     FROM mx_revision
     ${where}
     ORDER BY created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )
  const total = Number(countRows[0]?.total ?? 0)
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
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
    },
  }
}

export async function pruneAdminRevisions(db: Db, input: { olderThanDays: number; userId?: string; keepLatest?: number }) {
  const olderThanDays = Math.trunc(input.olderThanDays)
  if (!Number.isFinite(input.olderThanDays) || olderThanDays < 1 || olderThanDays > 3650) {
    throw new HttpError(400, "INVALID_RETENTION_WINDOW", "olderThanDays must be between 1 and 3650")
  }
  const keepLatest = input.keepLatest !== undefined ? Math.max(1, Math.trunc(input.keepLatest)) : 1

  const values: unknown[] = [olderThanDays]
  const userFilter = input.userId
    ? `AND physical_path LIKE $${(() => { values.push(`users/${input.userId}/%`); return values.length })()} `
    : ""

  const { rows } = await db.query<{ id: string }>(
    `DELETE FROM mx_revision
     WHERE created_at < now() - ($1 || ' days')::interval
     ${userFilter}
     AND id NOT IN (
       SELECT id FROM (
         SELECT id, ROW_NUMBER() OVER (PARTITION BY physical_path ORDER BY created_at DESC) AS rn
         FROM mx_revision
       ) ranked WHERE rn <= $${(() => { values.push(keepLatest); return values.length })()}
     )
     RETURNING id`,
    values,
  )

  return { deleted: rows.length }
}

export async function deleteAdminUser(db: Db, userId: string) {
  if (!userId?.trim()) throw new HttpError(400, "USER_ID_REQUIRED", "userId is required")

  const pathPrefix = `users/${userId}/%`

  const { rows: fileRows } = await db.query<{ id: string }>(
    `DELETE FROM mx_file WHERE physical_path LIKE $1 RETURNING id`,
    [pathPrefix],
  )

  const { rows: revRows } = await db.query<{ id: string }>(
    `DELETE FROM mx_revision WHERE physical_path LIKE $1 RETURNING id`,
    [pathPrefix],
  )

  const { rows: logRows } = await db.query<{ id: string }>(
    `DELETE FROM mx_access_log WHERE physical_path LIKE $1 OR user_id = $2 RETURNING id`,
    [pathPrefix, userId],
  )

  const { rows: dreamRows } = await db.query<{ user_id: string }>(
    `DELETE FROM mx_dream_run WHERE user_id = $1 RETURNING user_id`,
    [userId],
  )

  return {
    userId,
    filesDeleted: fileRows.length,
    revisionsDeleted: revRows.length,
    logsDeleted: logRows.length,
    dreamRunDeleted: dreamRows.length,
  }
}

export async function deleteAdminFile(db: Db, physicalPath: string) {
  if (!physicalPath) throw new HttpError(400, "PHYSICAL_PATH_REQUIRED", "physicalPath is required")

  const { rows } = await db.query<{ id: string }>(
    `DELETE FROM mx_file WHERE physical_path = $1 RETURNING id`,
    [physicalPath],
  )

  if (rows.length === 0) throw new HttpError(404, "FILE_NOT_FOUND", `File not found: ${physicalPath}`)
  return { physicalPath, deleted: true }
}

export async function getAdminRevisionDiff(db: Db, physicalPath: string, revAId?: string, revBId?: string) {
  if (!physicalPath) throw new HttpError(400, "PHYSICAL_PATH_REQUIRED", "physicalPath is required")

  const formatRev = (r: AdminRevisionRow) => ({ id: r.id, actor: r.actor, reason: r.reason, createdAt: r.created_at, content: r.content_text })

  if (revAId && revBId) {
    const { rows } = await db.query<AdminRevisionRow>(
      `SELECT id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id, created_at
       FROM mx_revision WHERE id = ANY($1) AND physical_path = $2`,
      [[revAId, revBId], physicalPath],
    )
    const rA = rows.find((r) => r.id === revAId)
    const rB = rows.find((r) => r.id === revBId)
    if (!rA) throw new HttpError(404, "REVISION_NOT_FOUND", `Revision not found: ${revAId}`)
    if (!rB) throw new HttpError(404, "REVISION_NOT_FOUND", `Revision not found: ${revBId}`)
    return { path: physicalPath, revA: formatRev(rA), revB: formatRev(rB) }
  }

  const { rows } = await db.query<AdminRevisionRow>(
    `SELECT id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id, created_at
     FROM mx_revision WHERE physical_path = $1
     ORDER BY created_at DESC LIMIT 2`,
    [physicalPath],
  )
  if (rows.length < 2) throw new HttpError(400, "NOT_ENOUGH_REVISIONS", "Need at least 2 revisions to diff")
  return { path: physicalPath, revA: formatRev(rows[1]!), revB: formatRev(rows[0]!) }
}

export async function getAdminTrace(db: Db, toolCallId: string) {
  if (!toolCallId) throw new HttpError(400, "TOOL_CALL_ID_REQUIRED", "toolCallId is required")

  const { rows: events } = await db.query<{
    id: string; event_type: string; status: string; duration_ms: number | null
    user_id: string | null; actor: string | null; tool_name: string | null
    operation: string | null; physical_path: string | null
    trace_id: string | null; span_id: string | null; parent_span_id: string | null
    error_code: string | null; attributes: Record<string, unknown> | null; created_at: Date
  }>(
    `SELECT id, event_type, status, duration_ms, user_id, actor, tool_name, operation,
            physical_path, trace_id, span_id, parent_span_id, error_code, attributes, created_at
     FROM mx_observation_event WHERE tool_call_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [toolCallId],
  )

  const { rows: accessLogs } = await db.query<AdminAccessLogRow>(
    `SELECT id, file_id, physical_path, operation, actor, user_id, tool_call_id, created_at
     FROM mx_access_log WHERE tool_call_id = $1 ORDER BY created_at ASC`,
    [toolCallId],
  )

  const { rows: revisions } = await db.query<AdminRevisionRow>(
    `SELECT id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id, created_at
     FROM mx_revision WHERE tool_call_id = $1 ORDER BY created_at ASC`,
    [toolCallId],
  )

  const event = events[0]
  return {
    toolCallId,
    event: event
      ? {
          id: event.id,
          eventType: event.event_type,
          status: event.status,
          durationMs: event.duration_ms,
          userId: event.user_id,
          actor: event.actor,
          toolName: event.tool_name,
          operation: event.operation,
          physicalPath: event.physical_path,
          traceId: event.trace_id,
          spanId: event.span_id,
          parentSpanId: event.parent_span_id,
          errorCode: event.error_code,
          createdAt: event.created_at,
        }
      : null,
    filesAccessed: accessLogs.map((r) => ({
      physicalPath: r.physical_path,
      operation: r.operation,
      actor: r.actor,
      createdAt: r.created_at,
    })),
    revisionsWritten: revisions.map((r) => ({
      id: r.id,
      physicalPath: r.physical_path,
      operation: r.operation,
      actor: r.actor,
      reason: r.reason,
      createdAt: r.created_at,
    })),
  }
}

export async function listAdminTraceSession(db: Db, input: { userId: string; from?: string; limit?: number }) {
  const limit = clampInt(input.limit, 50, 1, 200)
  const values: unknown[] = [input.userId]
  const filters = ["user_id = $1"]

  addDateFilter(filters, values, "created_at", ">=", input.from)
  values.push(limit)

  const { rows } = await db.query<{
    tool_call_id: string; tool_name: string | null; status: string
    duration_ms: number | null; operation: string | null; physical_path: string | null; created_at: Date
  }>(
    `SELECT tool_call_id, tool_name, status, duration_ms, operation, physical_path, created_at
     FROM mx_observation_event
     WHERE ${filters.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values,
  )

  return {
    userId: input.userId,
    events: rows.map((r) => ({
      toolCallId: r.tool_call_id,
      toolName: r.tool_name,
      status: r.status,
      durationMs: r.duration_ms,
      operation: r.operation,
      physicalPath: r.physical_path,
      createdAt: r.created_at,
    })),
  }
}

export async function listAdminDreamUsers(db: Db, input: {
  status?: string
  q?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
} = {}) {
  const values: unknown[] = []
  const baseFilters: string[] = []
  const filters: string[] = []
  const limit = clampInt(input.limit, 50, 1, 200)
  const offset = clampInt(input.offset, 0, 0, 100_000)
  const timestampExpr = "coalesce(last_started_at, last_dreamed_at, updated_at)"

  const q = input.q?.trim()
  if (q) {
    values.push(`%${q.toLowerCase()}%`)
    baseFilters.push(`lower(user_id) LIKE $${values.length}`)
  }
  addDateFilter(baseFilters, values, timestampExpr, ">=", input.from)
  addDateFilter(baseFilters, values, timestampExpr, "<=", input.to)
  filters.push(...baseFilters)
  if (input.status && DREAM_STATUSES.has(input.status)) {
    values.push(input.status)
    filters.push(`status = $${values.length}`)
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""
  const baseWhere = baseFilters.length ? `WHERE ${baseFilters.join(" AND ")}` : ""
  const totalValues = [...values]
  const summaryValues = values.slice(0, values.length - (input.status && DREAM_STATUSES.has(input.status) ? 1 : 0))
  const { rows: countRows } = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM mx_dream_run ${where}`,
    totalValues,
  )
  const { rows: summaryRows } = await db.query<{
    running: string
    failed: string
    completed: string
    paused: string
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'running') AS running,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE paused = true) AS paused
     FROM mx_dream_run
     ${baseWhere}`,
    summaryValues,
  )

  values.push(limit, offset)
  const { rows } = await db.query<AdminDreamRunRow>(
    `SELECT user_id, status, paused, last_dreamed_at, last_started_at, files_touched, error, dream_count, updated_at
     FROM mx_dream_run
     ${where}
     ORDER BY updated_at DESC, user_id ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )
  const total = Number(countRows[0]?.total ?? 0)
  const summary = summaryRows[0]

  return {
    users: rows.map(toAdminDreamUser),
    summary: {
      running: Number(summary?.running ?? 0),
      failed: Number(summary?.failed ?? 0),
      completed: Number(summary?.completed ?? 0),
      paused: Number(summary?.paused ?? 0),
    },
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
    },
    serverTime: new Date().toISOString(),
  }
}

export async function writeAdminFile(
  db: Db,
  physicalPath: string,
  content: string,
  reason?: string,
  embedding?: EmbeddingConfig,
) {
  if (!physicalPath) throw new HttpError(400, "PHYSICAL_PATH_REQUIRED", "physicalPath is required")
  if (typeof content !== "string") throw new HttpError(400, "CONTENT_REQUIRED", "content is required")
  let preparedEmbedding
  try {
    preparedEmbedding = await prepareFileEmbedding(content, embedding)
  } catch (error) {
    if (error instanceof SearchError) throw new HttpError(400, error.code, error.message)
    throw error
  }

  const { rows } = await db.query<{ id: string; created: boolean }>(
    `INSERT INTO mx_file (id, physical_path, content_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (physical_path)
     DO UPDATE SET content_text = EXCLUDED.content_text, updated_at = now()
     RETURNING id, (xmax = 0) AS created`,
    [newId("file"), physicalPath, content],
  )

  const file = rows[0]
  await storePreparedEmbedding(db, file.id, preparedEmbedding)
  await db.query(
    `INSERT INTO mx_revision (id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [newId("rev"), file.id, physicalPath, "write", content, reason ?? null, "admin", null, null],
  )

  return { physicalPath, created: file.created, updated: !file.created }
}

export async function listAdminAccessLogs(db: Db, input: {
  physicalPath?: string
  userId?: string
  toolCallId?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
} = {}) {
  const values: unknown[] = []
  const filters: string[] = []
  const limit = clampInt(input.limit, 200, 1, 500)
  const offset = clampInt(input.offset, 0, 0, 100_000)

  if (input.physicalPath) {
    values.push(input.physicalPath)
    filters.push(`physical_path = $${values.length}`)
  }
  if (input.userId) {
    values.push(input.userId)
    filters.push(`user_id = $${values.length}`)
  }
  if (input.toolCallId) {
    values.push(input.toolCallId)
    filters.push(`tool_call_id = $${values.length}`)
  }
  addDateFilter(filters, values, "created_at", ">=", input.from)
  addDateFilter(filters, values, "created_at", "<=", input.to)

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : ""
  const totalValues = [...values]
  const { rows: countRows } = await db.query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM mx_access_log ${where}`,
    totalValues,
  )
  values.push(limit, offset)
  const { rows } = await db.query<AdminAccessLogRow>(
    `SELECT id, file_id, physical_path, operation, actor, user_id, tool_call_id, created_at
     FROM mx_access_log
     ${where}
     ORDER BY created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )
  const total = Number(countRows[0]?.total ?? 0)
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
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
    },
  }
}

type AdminFileRow = {
  id: string
  physical_path: string
  content_text: string
  created_at: Date
  updated_at: Date
  embedding_model?: string | null
  embedding_dimensions?: number | null
  embedding_strategy?: string | null
  embedding_chunk_count?: number | null
  embedding_content_hash?: string | null
  embedding_updated_at?: Date | null
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

type AdminRevisionFileRow = {
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

type AdminDreamRunRow = {
  user_id: string
  status: string
  paused: boolean
  last_dreamed_at: Date | null
  last_started_at: Date | null
  files_touched: number | null
  error: string | null
  dream_count: number
  updated_at: Date
}

function embeddingStatus(row: AdminFileRow, embedding?: EmbeddingConfig): "fresh" | "missing" | "stale" | undefined {
  if (!embedding?.adapter) return undefined
  if (!row.embedding_content_hash) return "missing"
  if (row.embedding_model !== embedding.adapter.model) return "stale"
  if (row.embedding_dimensions !== embedding.adapter.dimensions) return "stale"
  if (row.embedding_content_hash !== contentHash(row.content_text)) return "stale"
  return "fresh"
}

function toAdminFileSummary(row: AdminFileRow, embedding?: EmbeddingConfig) {
  const status = embeddingStatus(row, embedding)
  return {
    id: row.id,
    physicalPath: row.physical_path,
    size: row.content_text.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(status
      ? {
          embeddingStatus: status,
          embeddingModel: row.embedding_model,
          embeddingDimensions: row.embedding_dimensions,
          embeddingStrategy: row.embedding_strategy,
          embeddingChunkCount: row.embedding_chunk_count,
          embeddingUpdatedAt: row.embedding_updated_at,
        }
      : {}),
  }
}

function toHistoricalAdminFileSummary(row: AdminRevisionFileRow) {
  return {
    id: row.file_id,
    physicalPath: row.physical_path,
    size: row.content_text.length,
    createdAt: row.created_at,
    updatedAt: row.created_at,
    matchedRevision: toMatchedRevisionMeta(row),
  }
}

function toRevisionMeta(row: AdminRevisionFileRow) {
  return {
    operation: row.operation,
    actor: row.actor,
    reason: row.reason,
    createdAt: row.created_at,
  }
}

function toMatchedRevisionMeta(row: AdminRevisionFileRow) {
  return {
    id: row.id,
    fileId: row.file_id,
    operation: row.operation,
    actor: row.actor,
    reason: row.reason,
    userId: row.user_id,
    toolCallId: row.tool_call_id,
    createdAt: row.created_at,
  }
}

function toAdminDreamUser(row: AdminDreamRunRow) {
  return {
    userId: row.user_id,
    status: row.status,
    paused: row.paused,
    lastDreamedAt: row.last_dreamed_at,
    lastStartedAt: row.last_started_at,
    filesTouched: row.files_touched,
    error: row.error,
    dreamCount: Number(row.dream_count),
    updatedAt: row.updated_at,
  }
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}

function addDateFilter(filters: string[], values: unknown[], expr: string, op: ">=" | "<=", value: string | undefined) {
  if (!value) return
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return
  values.push(date.toISOString())
  filters.push(`${expr} ${op} $${values.length}::timestamptz`)
}

export type AdminQuery<T> = QueryResult<T>
