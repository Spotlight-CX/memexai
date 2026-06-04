import type { Db } from "./db"
import { MemexError } from "./errors"
import { newId } from "./ids"

// ─── Row types ───────────────────────────────────────────────────────────────

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

type ObservationEventRow = {
  id: string
  event_type: string
  status: string
  duration_ms: number | null
  user_id: string | null
  actor: string | null
  tool_name: string | null
  operation: string | null
  physical_path: string | null
  tool_call_id: string | null
  error_code: string | null
  attributes: Record<string, unknown>
  created_at: Date
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DREAM_STATUSES = new Set(["idle", "running", "completed", "failed"])

function toAdminFileSummary(row: AdminFileRow) {
  return {
    id: row.id,
    physicalPath: row.physical_path,
    size: row.content_text.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

function addDateFilter(
  filters: string[],
  values: unknown[],
  expr: string,
  op: ">=" | "<=",
  value: string | Date | undefined,
) {
  if (!value) return
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return
  values.push(date.toISOString())
  filters.push(`${expr} ${op} $${values.length}::timestamptz`)
}

// ─── Users ────────────────────────────────────────────────────────────────────

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

// ─── Files ────────────────────────────────────────────────────────────────────

export async function listAdminFiles(db: Db, input: { prefix?: string } = {}) {
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
  if (!physicalPath) throw new MemexError("PHYSICAL_PATH_REQUIRED", "physicalPath is required")

  const { rows } = await db.query<AdminFileRow & {
    latest_op: string | null
    latest_actor: string | null
    latest_reason: string | null
    latest_rev_at: Date | null
    revision_count: string
  }>(
    `SELECT
       f.id, f.physical_path, f.content_text, f.created_at, f.updated_at,
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
  if (!file) throw new MemexError("FILE_NOT_FOUND", `File not found: ${physicalPath}`)

  return {
    file: {
      ...toAdminFileSummary(file),
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

export async function writeAdminFile(
  db: Db,
  physicalPath: string,
  content: string,
  reason?: string,
) {
  if (!physicalPath) throw new MemexError("PHYSICAL_PATH_REQUIRED", "physicalPath is required")
  if (typeof content !== "string") throw new MemexError("CONTENT_REQUIRED", "content is required")

  const { rows } = await db.query<{ id: string; created: boolean }>(
    `INSERT INTO mx_file (id, physical_path, content_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (physical_path)
     DO UPDATE SET content_text = EXCLUDED.content_text, updated_at = now()
     RETURNING id, (xmax = 0) AS created`,
    [newId("file"), physicalPath, content],
  )

  const file = rows[0]
  await db.query(
    `INSERT INTO mx_revision (id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [newId("rev"), file.id, physicalPath, "write", content, reason ?? null, "admin", null, null],
  )

  return { physicalPath, created: file.created, updated: !file.created }
}

// ─── Revisions ────────────────────────────────────────────────────────────────

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
    pagination: { limit, offset, total, hasMore: offset + limit < total },
  }
}

export async function pruneAdminRevisions(db: Db, input: { olderThanDays: number }) {
  const olderThanDays = Math.trunc(input.olderThanDays)
  if (!Number.isFinite(input.olderThanDays) || olderThanDays < 1 || olderThanDays > 3650) {
    throw new MemexError("INVALID_RETENTION_WINDOW", "olderThanDays must be between 1 and 3650")
  }

  const { rows } = await db.query<{ id: string }>(
    `DELETE FROM mx_revision
     WHERE created_at < now() - ($1 || ' days')::interval
     RETURNING id`,
    [olderThanDays],
  )

  return { deleted: rows.length }
}

export async function getRevisionAtOffset(db: Db, physicalPath: string, offset: number) {
  const n = Math.max(0, Math.trunc(offset))
  const { rows } = await db.query<AdminRevisionRow>(
    `SELECT id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id, created_at
     FROM mx_revision
     WHERE physical_path = $1
     ORDER BY created_at DESC
     LIMIT 1 OFFSET $2`,
    [physicalPath, n],
  )
  const row = rows[0]
  if (!row) throw new MemexError("REVISION_NOT_FOUND", `No revision at offset ${n} for ${physicalPath}`)
  return {
    id: row.id,
    physicalPath: row.physical_path,
    operation: row.operation,
    content: row.content_text,
    reason: row.reason,
    actor: row.actor,
    userId: row.user_id,
    toolCallId: row.tool_call_id,
    createdAt: row.created_at,
  }
}

// ─── Access logs ──────────────────────────────────────────────────────────────

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
    pagination: { limit, offset, total, hasMore: offset + limit < total },
  }
}

// ─── Dream ────────────────────────────────────────────────────────────────────

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
    pagination: { limit, offset, total, hasMore: offset + limit < total },
    serverTime: new Date().toISOString(),
  }
}

// ─── Time-travel ──────────────────────────────────────────────────────────────

/**
 * Reconstruct the full memory state for a user as it existed at a given timestamp.
 * Returns the latest revision of each file that was written at or before `asOf`.
 * If `asOf` is omitted, returns the current state from mx_file directly.
 */
export async function getMemorySnapshot(db: Db, userId: string, asOf?: Date) {
  if (!userId) throw new MemexError("USER_ID_REQUIRED", "userId is required")

  if (!asOf) {
    const { rows } = await db.query<AdminFileRow>(
      `SELECT id, physical_path, content_text, created_at, updated_at
       FROM mx_file
       WHERE physical_path LIKE $1
       ORDER BY physical_path ASC`,
      [`users/${userId}/%`],
    )
    return {
      userId,
      asOf: null,
      files: rows.map((row) => ({
        physicalPath: row.physical_path,
        content: row.content_text,
        size: row.content_text.length,
        writtenAt: row.updated_at,
        actor: null,
        reason: null,
        toolCallId: null,
      })),
    }
  }

  // DISTINCT ON gets the latest revision of each file at or before asOf
  const { rows } = await db.query<{
    physical_path: string
    content_text: string
    written_at: Date
    actor: string | null
    reason: string | null
    tool_call_id: string | null
  }>(
    `SELECT DISTINCT ON (physical_path)
       physical_path, content_text, created_at AS written_at, actor, reason, tool_call_id
     FROM mx_revision
     WHERE physical_path LIKE $1
       AND created_at <= $2::timestamptz
     ORDER BY physical_path, created_at DESC`,
    [`users/${userId}/%`, asOf.toISOString()],
  )

  return {
    userId,
    asOf: asOf.toISOString(),
    files: rows.map((row) => ({
      physicalPath: row.physical_path,
      content: row.content_text,
      size: row.content_text.length,
      writtenAt: row.written_at,
      actor: row.actor,
      reason: row.reason,
      toolCallId: row.tool_call_id,
    })),
  }
}

// ─── Agentic trace ────────────────────────────────────────────────────────────

/**
 * Fetch all records tied to a single tool_call_id across observation events,
 * access logs, and revisions. Use this to understand exactly what one agent
 * tool call did.
 */
export async function getAgenticTrace(db: Db, toolCallId: string) {
  if (!toolCallId) throw new MemexError("TOOL_CALL_ID_REQUIRED", "toolCallId is required")

  const [eventsResult, logsResult, revisionsResult] = await Promise.all([
    db.query<ObservationEventRow>(
      `SELECT id, event_type, status, duration_ms, user_id, actor, tool_name, operation,
              physical_path, tool_call_id, error_code, attributes, created_at
       FROM mx_observation_event
       WHERE tool_call_id = $1
       ORDER BY created_at ASC`,
      [toolCallId],
    ),
    db.query<AdminAccessLogRow>(
      `SELECT id, file_id, physical_path, operation, actor, user_id, tool_call_id, created_at
       FROM mx_access_log
       WHERE tool_call_id = $1
       ORDER BY created_at ASC`,
      [toolCallId],
    ),
    db.query<AdminRevisionRow & { size: number }>(
      `SELECT physical_path, operation, LENGTH(content_text) AS size, reason, actor, user_id, created_at, tool_call_id
       FROM mx_revision
       WHERE tool_call_id = $1
       ORDER BY created_at ASC`,
      [toolCallId],
    ),
  ])

  const event = eventsResult.rows[0]
    ? {
        id: eventsResult.rows[0].id,
        eventType: eventsResult.rows[0].event_type,
        status: eventsResult.rows[0].status,
        durationMs: eventsResult.rows[0].duration_ms,
        userId: eventsResult.rows[0].user_id,
        actor: eventsResult.rows[0].actor,
        toolName: eventsResult.rows[0].tool_name,
        errorCode: eventsResult.rows[0].error_code,
        attributes: eventsResult.rows[0].attributes,
        createdAt: eventsResult.rows[0].created_at,
      }
    : null

  return {
    toolCallId,
    event,
    accessLog: logsResult.rows.map((row) => ({
      physicalPath: row.physical_path,
      operation: row.operation,
      actor: row.actor,
      userId: row.user_id,
      createdAt: row.created_at,
    })),
    revisions: revisionsResult.rows.map((row) => ({
      physicalPath: row.physical_path,
      operation: row.operation,
      sizeBytes: (row as unknown as { size: number }).size,
      reason: row.reason,
      actor: row.actor,
      userId: row.user_id,
      createdAt: row.created_at,
    })),
  }
}

/**
 * Fetch all tool calls for a user within a time range, grouped by tool_call_id.
 * Useful for session-level tracing.
 */
export async function listAgenticTraceSession(db: Db, input: {
  userId: string
  from?: string | Date
  to?: string | Date
  limit?: number
}) {
  if (!input.userId) throw new MemexError("USER_ID_REQUIRED", "userId is required")
  const values: unknown[] = [input.userId]
  const filters = ["user_id = $1"]
  const limit = clampInt(input.limit, 50, 1, 200)

  addDateFilter(filters, values, "created_at", ">=", input.from as string | undefined)
  addDateFilter(filters, values, "created_at", "<=", input.to as string | undefined)

  values.push(limit)
  const { rows } = await db.query<{
    tool_call_id: string | null
    tool_name: string | null
    status: string
    duration_ms: number | null
    operation: string | null
    physical_path: string | null
    error_code: string | null
    created_at: Date
  }>(
    `SELECT tool_call_id, tool_name, status, duration_ms, operation, physical_path, error_code, created_at
     FROM mx_observation_event
     WHERE ${filters.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values,
  )

  return {
    userId: input.userId,
    events: rows.map((row) => ({
      toolCallId: row.tool_call_id,
      toolName: row.tool_name,
      status: row.status,
      durationMs: row.duration_ms,
      operation: row.operation,
      physicalPath: row.physical_path,
      errorCode: row.error_code,
      createdAt: row.created_at,
    })),
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Check whether shared memory has been bootstrapped.
 * Bootstrapped = at least one shared/ file exists.
 */
export async function getAdminSetupStatus(db: Db) {
  const { rows: sharedFiles } = await db.query<{ physical_path: string }>(
    `SELECT physical_path FROM mx_file WHERE physical_path LIKE 'shared/%' ORDER BY physical_path ASC`,
  )

  const { rows: configRows } = await db.query<{ key: string; value: string }>(
    `SELECT key, value FROM mx_config WHERE key IN ('setup_completed', 'setup_note', 'setup_completed_at')`,
  )

  const config: Record<string, string> = {}
  for (const row of configRows) config[row.key] = row.value

  const bootstrapped = sharedFiles.length > 0 && config["setup_completed"] === "true"
  const nextSteps: string[] = []
  if (sharedFiles.length === 0) {
    nextSteps.push("Write shared/index.md to define agent memory scope")
    nextSteps.push("Run: memex-admin files write shared/index.md --content '...' --reason 'bootstrap'")
  }
  if (sharedFiles.length > 0 && config["setup_completed"] !== "true") {
    nextSteps.push("Run: memex-admin setup complete --note '<your product description>'")
  }

  return {
    bootstrapped,
    sharedFiles: sharedFiles.map((r) => r.physical_path),
    setupCompletedAt: config["setup_completed_at"] ?? null,
    setupNote: config["setup_note"] ?? null,
    nextSteps,
  }
}

export async function writeAdminSetupComplete(db: Db, note?: string) {
  const now = new Date().toISOString()
  await db.query(
    `INSERT INTO mx_config (key, value, description)
     VALUES ('setup_completed', 'true', 'Set by memex-admin setup complete'),
            ('setup_completed_at', $1, 'Timestamp of setup completion'),
            ('setup_note', $2, 'Note from setup complete')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [now, note ?? ""],
  )

  const { files } = await listAdminFiles(db, { prefix: "shared/" })
  return {
    setupCompletedAt: now,
    note: note ?? null,
    sharedFiles: files.map((f) => f.physicalPath),
  }
}
