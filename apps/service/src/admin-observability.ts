import type { Db } from "./db"
import { newId } from "./ids"

export type ObservationStatus = "success" | "error"

export type ObservationEventInput = {
  eventType: "tool_execution" | "prompt_block" | "admin_route" | "dream_run" | "mcp_session"
  status: ObservationStatus
  durationMs?: number | null
  userId?: string | null
  actor?: string | null
  toolName?: string | null
  operation?: string | null
  physicalPath?: string | null
  toolCallId?: string | null
  errorCode?: string | null
  traceId?: string | null
  spanId?: string | null
  parentSpanId?: string | null
  attributes?: Record<string, unknown>
}

const ALLOWED_ATTRIBUTE_KEYS = new Set([
  "changed",
  "created",
  "files_included",
  "files_omitted",
  "files_returned",
  "route_kind",
  "truncated",
  "updated",
])

export async function recordObservationEvent(db: Db, input: ObservationEventInput): Promise<void> {
  try {
    await db.query(
      `INSERT INTO mx_observation_event (
         id, event_type, status, duration_ms, user_id, actor, tool_name, operation,
         physical_path, tool_call_id, error_code, trace_id, span_id, parent_span_id, attributes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)`,
      [
        newId("obs"),
        input.eventType,
        input.status,
        normalizeDuration(input.durationMs),
        input.userId ?? null,
        input.actor ?? null,
        input.toolName ?? null,
        input.operation ?? null,
        input.physicalPath ?? null,
        input.toolCallId ?? null,
        input.errorCode ?? null,
        input.traceId ?? null,
        input.spanId ?? null,
        input.parentSpanId ?? null,
        JSON.stringify(sanitizeObservationAttributes(input.attributes)),
      ],
    )
  } catch {
    // Local observability must never affect the memory service behavior.
  }
}

export function sanitizeObservationAttributes(input: Record<string, unknown> = {}): Record<string, string | number | boolean | null> {
  const clean: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_ATTRIBUTE_KEYS.has(key)) continue
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      clean[key] = value
    }
  }
  return clean
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Math.max(0, Math.trunc(value))
}

export type ObservabilityFilters = {
  from?: string
  to?: string
  userId?: string
  physicalPath?: string
  toolName?: string
  operation?: string
  status?: string
  actor?: string
  bucket?: string
  limit?: number
  offset?: number
}

export async function getObservabilitySummary(db: Db, input: ObservabilityFilters = {}) {
  const event = buildObservationWhere(input)
  const access = buildAccessWhere(input)

  const [{ rows: eventRows }, { rows: accessRows }] = await Promise.all([
    db.query<{
      tool_calls: string
      prompt_blocks: string
      errors: string
      active_users: string
      p50_ms: string | number | null
      p95_ms: string | number | null
      slowest_tool_name: string | null
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'tool_execution') AS tool_calls,
          COUNT(*) FILTER (WHERE event_type = 'prompt_block') AS prompt_blocks,
          COUNT(*) FILTER (WHERE status = 'error') AS errors,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS active_users,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS p50_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS p95_ms,
          (
            SELECT tool_name
            FROM mx_observation_event
            ${event.where}
              ${event.where ? "AND" : "WHERE"} tool_name IS NOT NULL AND duration_ms IS NOT NULL
            ORDER BY duration_ms DESC
            LIMIT 1
          ) AS slowest_tool_name
        FROM mx_observation_event
        ${event.where}
      `,
      event.values,
    ),
    db.query<{
      file_hits: string
      reads: string
      writes: string
      searches: string
      smart_reads: string
    }>(
      `
        SELECT
          COUNT(*) AS file_hits,
          COUNT(*) FILTER (WHERE operation = 'read') AS reads,
          COUNT(*) FILTER (WHERE operation IN ('write', 'patch')) AS writes,
          COUNT(*) FILTER (WHERE operation = 'search') AS searches,
          COUNT(*) FILTER (WHERE operation = 'smart_read') AS smart_reads
        FROM mx_access_log
        ${access.where}
      `,
      access.values,
    ),
  ])

  const eventRow = eventRows[0]
  const accessRow = accessRows[0]
  const toolCalls = toNumber(eventRow?.tool_calls)
  const errors = toNumber(eventRow?.errors)
  const reads = toNumber(accessRow?.reads)
  const writes = toNumber(accessRow?.writes)

  return {
    totals: {
      toolCalls,
      promptBlocks: toNumber(eventRow?.prompt_blocks),
      activeUsers: toNumber(eventRow?.active_users),
      fileHits: toNumber(accessRow?.file_hits),
      reads,
      writes,
      searches: toNumber(accessRow?.searches),
      smartReads: toNumber(accessRow?.smart_reads),
      errors,
    },
    latency: {
      p50Ms: nullableNumber(eventRow?.p50_ms),
      p95Ms: nullableNumber(eventRow?.p95_ms),
      slowestToolName: eventRow?.slowest_tool_name ?? null,
    },
    ratios: {
      errorRate: toolCalls > 0 ? errors / toolCalls : 0,
      readWriteRatio: writes > 0 ? reads / writes : null,
    },
  }
}

export async function getObservabilityTimeseries(db: Db, input: ObservabilityFilters = {}) {
  const bucket = bucketExpr(input.bucket)
  const event = buildObservationWhere(input)
  const access = buildAccessWhere(input)
  const values = [...access.values, ...event.values]
  const eventOffset = access.values.length
  const eventWhere = shiftPlaceholders(event.where, eventOffset)

  const { rows } = await db.query<{
    bucket_start: Date
    reads: string
    writes: string
    searches: string
    smart_reads: string
    tool_calls: string
    errors: string
    p50_ms: string | number | null
    p95_ms: string | number | null
  }>(
    `
      WITH access_buckets AS (
        SELECT
          ${bucket} AS bucket_start,
          COUNT(*) FILTER (WHERE operation = 'read') AS reads,
          COUNT(*) FILTER (WHERE operation IN ('write', 'patch')) AS writes,
          COUNT(*) FILTER (WHERE operation = 'search') AS searches,
          COUNT(*) FILTER (WHERE operation = 'smart_read') AS smart_reads
        FROM mx_access_log
        ${access.where}
        GROUP BY 1
      ),
      event_buckets AS (
        SELECT
          ${bucket.replaceAll("created_at", "created_at")} AS bucket_start,
          COUNT(*) FILTER (WHERE event_type = 'tool_execution') AS tool_calls,
          COUNT(*) FILTER (WHERE status = 'error') AS errors,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS p50_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS p95_ms
        FROM mx_observation_event
        ${eventWhere}
        GROUP BY 1
      )
      SELECT
        COALESCE(access_buckets.bucket_start, event_buckets.bucket_start) AS bucket_start,
        COALESCE(reads, 0) AS reads,
        COALESCE(writes, 0) AS writes,
        COALESCE(searches, 0) AS searches,
        COALESCE(smart_reads, 0) AS smart_reads,
        COALESCE(tool_calls, 0) AS tool_calls,
        COALESCE(errors, 0) AS errors,
        p50_ms,
        p95_ms
      FROM access_buckets
      FULL OUTER JOIN event_buckets USING (bucket_start)
      ORDER BY bucket_start ASC
    `,
    values,
  )

  return {
    buckets: rows.map((row) => ({
      bucketStart: row.bucket_start,
      reads: toNumber(row.reads),
      writes: toNumber(row.writes),
      searches: toNumber(row.searches),
      smartReads: toNumber(row.smart_reads),
      toolCalls: toNumber(row.tool_calls),
      errors: toNumber(row.errors),
      p50Ms: nullableNumber(row.p50_ms),
      p95Ms: nullableNumber(row.p95_ms),
    })),
  }
}

export async function listObservabilityTopFiles(db: Db, input: ObservabilityFilters = {}) {
  const access = buildAccessWhere(input)
  const limit = clampInt(input.limit, 20, 1, 100)
  const values = [...access.values, limit]
  const { rows } = await db.query<{
    physical_path: string
    reads: string
    writes: string
    searches: string
    smart_reads: string
    total_hits: string
    unique_users: string
    size: string | number | null
    last_accessed_at: Date | null
  }>(
    `
      SELECT
        l.physical_path,
        COUNT(*) FILTER (WHERE l.operation = 'read') AS reads,
        COUNT(*) FILTER (WHERE l.operation IN ('write', 'patch')) AS writes,
        COUNT(*) FILTER (WHERE l.operation = 'search') AS searches,
        COUNT(*) FILTER (WHERE l.operation = 'smart_read') AS smart_reads,
        COUNT(*) AS total_hits,
        COUNT(DISTINCT l.user_id) FILTER (WHERE l.user_id IS NOT NULL) AS unique_users,
        MAX(length(f.content_text)) AS size,
        MAX(l.created_at) AS last_accessed_at
      FROM mx_access_log l
      LEFT JOIN mx_file f ON f.physical_path = l.physical_path
      ${access.where.replaceAll("physical_path", "l.physical_path").replaceAll("created_at", "l.created_at").replaceAll("user_id", "l.user_id").replaceAll("operation", "l.operation").replaceAll("actor", "l.actor")}
      GROUP BY l.physical_path
      ORDER BY total_hits DESC, last_accessed_at DESC NULLS LAST
      LIMIT $${values.length}
    `,
    values,
  )

  return {
    files: rows.map((row) => ({
      physicalPath: row.physical_path,
      reads: toNumber(row.reads),
      writes: toNumber(row.writes),
      searches: toNumber(row.searches),
      smartReads: toNumber(row.smart_reads),
      totalHits: toNumber(row.total_hits),
      uniqueUsers: toNumber(row.unique_users),
      size: nullableNumber(row.size),
      lastAccessedAt: row.last_accessed_at,
    })),
  }
}

export async function listObservabilityEvents(db: Db, input: ObservabilityFilters = {}) {
  const event = buildObservationWhere(input)
  const limit = clampInt(input.limit, 50, 1, 200)
  const offset = clampInt(input.offset, 0, 0, 100_000)
  const values = [...event.values, limit, offset]
  const { rows } = await db.query<{
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
  }>(
    `
      SELECT id, event_type, status, duration_ms, user_id, actor, tool_name, operation,
             physical_path, tool_call_id, error_code, attributes, created_at
      FROM mx_observation_event
      ${event.where}
      ORDER BY created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `,
    values,
  )

  return {
    events: rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      status: row.status,
      durationMs: row.duration_ms,
      userId: row.user_id,
      actor: row.actor,
      toolName: row.tool_name,
      operation: row.operation,
      physicalPath: row.physical_path,
      toolCallId: row.tool_call_id,
      errorCode: row.error_code,
      attributes: row.attributes,
      createdAt: row.created_at,
    })),
    pagination: { limit, offset },
  }
}

export async function getUserMemoryObservability(db: Db, input: ObservabilityFilters = {}) {
  const userId = input.userId?.trim()
  if (!userId) {
    return {
      userId: null,
      summary: { filesRead: 0, filesWritten: 0, searches: 0, failedCalls: 0, p95Ms: null },
      topReadFiles: [],
      topWrittenFiles: [],
      rewrittenFiles: [],
      rarelyReadFiles: [],
      recentEvents: [],
    }
  }

  const scoped = { ...input, userId }
  const access = buildAccessWhere(scoped)
  const event = buildObservationWhere(scoped)

  const [
    { rows: summaryRows },
    { rows: readRows },
    { rows: writeRows },
    { rows: churnRows },
    { rows: rareRows },
    { rows: failureRows },
    eventRows,
  ] = await Promise.all([
    db.query<{
      files_read: string
      files_written: string
      searches: string
    }>(
      `
        SELECT
          COUNT(DISTINCT physical_path) FILTER (WHERE operation = 'read') AS files_read,
          COUNT(DISTINCT physical_path) FILTER (WHERE operation IN ('write', 'patch')) AS files_written,
          COUNT(*) FILTER (WHERE operation IN ('search', 'smart_read')) AS searches
        FROM mx_access_log
        ${access.where}
      `,
      access.values,
    ),
    db.query<FileCountRow>(
      `
        SELECT physical_path, COUNT(*) AS count, MAX(created_at) AS last_seen_at
        FROM mx_access_log
        ${access.where} ${access.where ? "AND" : "WHERE"} operation = 'read'
        GROUP BY physical_path
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
      access.values,
    ),
    db.query<FileCountRow>(
      `
        SELECT physical_path, COUNT(*) AS count, MAX(created_at) AS last_seen_at
        FROM mx_access_log
        ${access.where} ${access.where ? "AND" : "WHERE"} operation IN ('write', 'patch')
        GROUP BY physical_path
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
      access.values,
    ),
    db.query<FileCountRow>(
      `
        SELECT physical_path, COUNT(*) AS count, MAX(created_at) AS last_seen_at
        FROM mx_revision
        WHERE user_id = $1
        GROUP BY physical_path
        HAVING COUNT(*) > 1
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
      [userId],
    ),
    db.query<{
      physical_path: string
      created_at: Date
      read_count: string
    }>(
      `
        SELECT f.physical_path, f.created_at, COUNT(l.id) AS read_count
        FROM mx_file f
        LEFT JOIN mx_access_log l ON l.physical_path = f.physical_path AND l.operation = 'read'
        WHERE f.physical_path LIKE $1
        GROUP BY f.physical_path, f.created_at
        HAVING COUNT(l.id) = 0
        ORDER BY f.created_at DESC
        LIMIT 8
      `,
      [`users/${userId}/%`],
    ),
    db.query<{
      failed_calls: string
      p95_ms: string | number | null
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'error') AS failed_calls,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE duration_ms IS NOT NULL) AS p95_ms
        FROM mx_observation_event
        ${event.where}
      `,
      event.values,
    ),
    listObservabilityEvents(db, { ...scoped, limit: 8 }),
  ])

  const summary = summaryRows[0]
  const failures = failureRows[0]
  return {
    userId,
    summary: {
      filesRead: toNumber(summary?.files_read),
      filesWritten: toNumber(summary?.files_written),
      searches: toNumber(summary?.searches),
      failedCalls: toNumber(failures?.failed_calls),
      p95Ms: nullableNumber(failures?.p95_ms),
    },
    topReadFiles: readRows.map(toFileCount),
    topWrittenFiles: writeRows.map(toFileCount),
    rewrittenFiles: churnRows.map(toFileCount),
    rarelyReadFiles: rareRows.map((row) => ({
      physicalPath: row.physical_path,
      count: toNumber(row.read_count),
      lastSeenAt: row.created_at,
    })),
    recentEvents: eventRows.events,
  }
}

export async function getObservabilitySchemaSignals(db: Db, input: ObservabilityFilters = {}) {
  const access = buildAccessWhere(input)
  const values = access.values
  const accessWhere = prefixWhere(access.where, "l")

  const [
    { rows: hotRows },
    { rows: coldRows },
    { rows: coHitRows },
    { rows: churnRows },
    { rows: sharedRows },
    { rows: searchRows },
  ] = await Promise.all([
    db.query<SchemaFileSignalRow>(
      `
        SELECT f.physical_path, length(f.content_text) AS size, COUNT(l.id) AS count, MAX(l.created_at) AS last_seen_at
        FROM mx_file f
        JOIN mx_access_log l ON l.physical_path = f.physical_path
        ${accessWhere ? `${accessWhere} AND` : "WHERE"} l.operation = 'read'
        GROUP BY f.physical_path, f.content_text
        ORDER BY COUNT(l.id) DESC, length(f.content_text) DESC
        LIMIT 8
      `,
      values,
    ),
    db.query<SchemaFileSignalRow>(
      `
        SELECT f.physical_path, length(f.content_text) AS size, COUNT(l.id) AS count, MAX(l.created_at) AS last_seen_at
        FROM mx_file f
        LEFT JOIN mx_access_log l ON l.physical_path = f.physical_path AND l.operation = 'read'
        GROUP BY f.physical_path, f.content_text, f.updated_at
        HAVING COUNT(l.id) = 0
        ORDER BY f.updated_at ASC
        LIMIT 8
      `,
    ),
    db.query<{
      source_path: string
      related_path: string
      count: string
      last_seen_at: Date | null
    }>(
      `
        SELECT a.physical_path AS source_path, b.physical_path AS related_path, COUNT(*) AS count, MAX(a.created_at) AS last_seen_at
        FROM mx_access_log a
        JOIN mx_access_log b ON b.tool_call_id = a.tool_call_id
          AND b.physical_path <> a.physical_path
          AND b.tool_call_id IS NOT NULL
        GROUP BY a.physical_path, b.physical_path
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
    ),
    db.query<SchemaFileSignalRow>(
      `
        SELECT physical_path, 0 AS size, COUNT(*) AS count, MAX(created_at) AS last_seen_at
        FROM mx_revision
        GROUP BY physical_path
        HAVING COUNT(*) > 2
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
    ),
    db.query<SchemaFileSignalRow>(
      `
        SELECT physical_path, 0 AS size, COUNT(*) AS count, MAX(created_at) AS last_seen_at
        FROM mx_access_log
        WHERE physical_path LIKE 'shared/%'
        GROUP BY physical_path
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
    ),
    db.query<{
      user_id: string | null
      count: string
      last_seen_at: Date | null
    }>(
      `
        SELECT user_id, COUNT(*) AS count, MAX(created_at) AS last_seen_at
        FROM mx_access_log
        WHERE operation IN ('search', 'smart_read')
        GROUP BY user_id
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
    ),
  ])

  return {
    hotLargeFiles: hotRows.map(toSchemaFileSignal),
    coldFiles: coldRows.map(toSchemaFileSignal),
    coHitFiles: coHitRows.map((row) => ({
      sourcePath: row.source_path,
      relatedPath: row.related_path,
      count: toNumber(row.count),
      lastSeenAt: row.last_seen_at,
    })),
    rewriteChurn: churnRows.map(toSchemaFileSignal),
    sharedUsage: sharedRows.map(toSchemaFileSignal),
    searchHeavyUsers: searchRows.map((row) => ({
      userId: row.user_id,
      count: toNumber(row.count),
      lastSeenAt: row.last_seen_at,
    })),
  }
}

type FileCountRow = {
  physical_path: string
  count: string
  last_seen_at: Date | null
}

function toFileCount(row: FileCountRow) {
  return {
    physicalPath: row.physical_path,
    count: toNumber(row.count),
    lastSeenAt: row.last_seen_at,
  }
}

type SchemaFileSignalRow = {
  physical_path: string
  size: string | number | null
  count: string
  last_seen_at: Date | null
}

function toSchemaFileSignal(row: SchemaFileSignalRow) {
  return {
    physicalPath: row.physical_path,
    size: nullableNumber(row.size),
    count: toNumber(row.count),
    lastSeenAt: row.last_seen_at,
  }
}

function buildObservationWhere(input: ObservabilityFilters) {
  const values: unknown[] = []
  const filters: string[] = []
  addDateFilter(filters, values, "created_at", ">=", input.from)
  addDateFilter(filters, values, "created_at", "<=", input.to)
  addTextFilter(filters, values, "user_id", input.userId)
  addTextFilter(filters, values, "physical_path", input.physicalPath)
  addTextFilter(filters, values, "tool_name", input.toolName)
  addTextFilter(filters, values, "operation", input.operation)
  addTextFilter(filters, values, "status", input.status)
  addTextFilter(filters, values, "actor", input.actor)
  return { where: filters.length ? `WHERE ${filters.join(" AND ")}` : "", values }
}

function buildAccessWhere(input: ObservabilityFilters) {
  const values: unknown[] = []
  const filters: string[] = []
  addDateFilter(filters, values, "created_at", ">=", input.from)
  addDateFilter(filters, values, "created_at", "<=", input.to)
  addTextFilter(filters, values, "user_id", input.userId)
  addTextFilter(filters, values, "physical_path", input.physicalPath)
  addTextFilter(filters, values, "operation", input.operation)
  addTextFilter(filters, values, "actor", input.actor)
  return { where: filters.length ? `WHERE ${filters.join(" AND ")}` : "", values }
}

function addTextFilter(filters: string[], values: unknown[], column: string, value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return
  values.push(trimmed)
  filters.push(`${column} = $${values.length}`)
}

function addDateFilter(filters: string[], values: unknown[], column: string, op: ">=" | "<=", value: string | undefined) {
  if (!value) return
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return
  values.push(date.toISOString())
  filters.push(`${column} ${op} $${values.length}::timestamptz`)
}

function shiftPlaceholders(sql: string, offset: number): string {
  if (!offset) return sql
  return sql.replace(/\$(\d+)/g, (_match, value) => `$${Number(value) + offset}`)
}

function prefixWhere(where: string, alias: string): string {
  return where
    .replaceAll("physical_path", `${alias}.physical_path`)
    .replaceAll("created_at", `${alias}.created_at`)
    .replaceAll("user_id", `${alias}.user_id`)
    .replaceAll("operation", `${alias}.operation`)
    .replaceAll("actor", `${alias}.actor`)
}

function bucketExpr(bucket: string | undefined) {
  return bucket === "day" ? "date_trunc('day', created_at)" : "date_trunc('hour', created_at)"
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), min), max)
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return Number(value)
}

function nullableNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}
