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
  "bm25_candidate_limit",
  "candidate_count",
  "changed",
  "created",
  "dry_run",
  "embedding_chunk_count",
  "embedding_dimensions",
  "embedding_model",
  "embedding_ms",
  "embedding_strategy",
  "files_included",
  "files_omitted",
  "files_read",
  "files_returned",
  "input_tokens",
  "model",
  "output_tokens",
  "provider",
  "query_embedding",
  "read_count",
  "rrf_k",
  "route_kind",
  "search_mode",
  "sources_returned",
  "total_tokens",
  "truncated",
  "updated",
  "vector_candidate_limit",
  "write_count",
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
  normalizedPath?: string
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
          COUNT(*) FILTER (WHERE operation IN ('search', 'find')) AS searches,
          COUNT(*) FILTER (WHERE operation IN ('smart_read', 'context')) AS smart_reads
        FROM mx_access_log
        ${access.where}
      `,
      access.values,
    ),
  ])

  const eventRow = eventRows[0]
  const accessRow = accessRows[0]
  const toolCalls = toNumber(eventRow?.tool_calls)
  const promptBlocks = toNumber(eventRow?.prompt_blocks)
  const observedEvents = toolCalls + promptBlocks
  const errors = toNumber(eventRow?.errors)
  const reads = toNumber(accessRow?.reads)
  const writes = toNumber(accessRow?.writes)

  return {
    totals: {
      toolCalls,
      promptBlocks,
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
      errorRate: observedEvents > 0 ? errors / observedEvents : 0,
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
          COUNT(*) FILTER (WHERE operation IN ('search', 'find')) AS searches,
          COUNT(*) FILTER (WHERE operation IN ('smart_read', 'context')) AS smart_reads
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
    normalized_path: string
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
        ${normalizedPathExpr("l.physical_path")} AS normalized_path,
        COUNT(*) FILTER (WHERE l.operation = 'read') AS reads,
        COUNT(*) FILTER (WHERE l.operation IN ('write', 'patch')) AS writes,
        COUNT(*) FILTER (WHERE l.operation IN ('search', 'find')) AS searches,
        COUNT(*) FILTER (WHERE l.operation IN ('smart_read', 'context')) AS smart_reads,
        COUNT(*) AS total_hits,
        COUNT(DISTINCT l.user_id) FILTER (WHERE l.user_id IS NOT NULL) AS unique_users,
        MAX(length(f.content_text)) AS size,
        MAX(l.created_at) AS last_accessed_at
      FROM mx_access_log l
      LEFT JOIN mx_file f ON f.physical_path = l.physical_path
      ${prefixWhere(access.where, "l")}
      GROUP BY normalized_path
      ORDER BY total_hits DESC, last_accessed_at DESC NULLS LAST
      LIMIT $${values.length}
    `,
    values,
  )

  return {
    files: rows.map((row) => ({
      physicalPath: row.normalized_path,
      normalizedPath: row.normalized_path,
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

export async function getObservabilityTree(db: Db, input: ObservabilityFilters = {}) {
  const access = buildAccessWhere(input)
  const accessWhere = prefixWhere(access.where, "l")
  const revision = buildRevisionWhere(input)
  const event = buildObservationWhere({ ...input, normalizedPath: undefined })
  const eventValues = [...event.values]
  const eventFilters = [prefixWhere(event.where, "e").replace(/^WHERE /, "")]
    .filter(Boolean)
  if (input.normalizedPath?.trim()) {
    eventValues.push(input.normalizedPath.trim())
    eventFilters.push(`${normalizedPathExpr("COALESCE(e.physical_path, l.physical_path)")} = $${eventValues.length}`)
  }
  const eventWhere = eventFilters.length ? `WHERE ${eventFilters.join(" AND ")}` : ""
  const fileWhere = buildFileWhere(input)

  const [
    { rows: accessRows },
    { rows: revisionRows },
    { rows: eventRows },
    { rows: fileRows },
  ] = await Promise.all([
    db.query<TreeAccessRow>(
      `
        SELECT
          ${normalizedPathExpr("l.physical_path")} AS normalized_path,
          COUNT(*) FILTER (WHERE l.operation = 'read') AS reads,
          COUNT(*) FILTER (WHERE l.operation IN ('write', 'patch')) AS writes,
          COUNT(*) FILTER (WHERE l.operation IN ('search', 'find')) AS searches,
          COUNT(*) FILTER (WHERE l.operation IN ('smart_read', 'context')) AS smart_reads,
          COUNT(*) AS total_hits,
          COUNT(DISTINCT l.user_id) FILTER (WHERE l.user_id IS NOT NULL) AS unique_users,
          ARRAY_AGG(DISTINCT l.user_id) FILTER (WHERE l.user_id IS NOT NULL) AS user_ids,
          MAX(length(f.content_text)) AS size,
          MAX(l.created_at) AS last_accessed_at
        FROM mx_access_log l
        LEFT JOIN mx_file f ON f.physical_path = l.physical_path
        ${accessWhere}
        GROUP BY normalized_path
      `,
      access.values,
    ),
    db.query<{ normalized_path: string; revisions: string; last_revised_at: Date | null }>(
      `
        SELECT
          ${normalizedPathExpr("physical_path")} AS normalized_path,
          COUNT(*) AS revisions,
          MAX(created_at) AS last_revised_at
        FROM mx_revision
        ${revision.where}
        GROUP BY normalized_path
      `,
      revision.values,
    ),
    db.query<{ normalized_path: string; errors: string; p95_ms: string | number | null }>(
      `
        SELECT
          ${normalizedPathExpr("COALESCE(e.physical_path, l.physical_path)")} AS normalized_path,
          COUNT(*) FILTER (WHERE e.status = 'error') AS errors,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL) AS p95_ms
        FROM mx_observation_event e
        LEFT JOIN mx_access_log l ON l.tool_call_id = e.tool_call_id AND l.tool_call_id IS NOT NULL
        ${eventWhere}
        GROUP BY normalized_path
      `,
      eventValues,
    ),
    db.query<{ normalized_path: string; files: string; new_files: string; updated_files: string; stale_files: string }>(
      `
        SELECT
          ${normalizedPathExpr("physical_path")} AS normalized_path,
          COUNT(*) AS files,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days') AS new_files,
          COUNT(*) FILTER (WHERE updated_at >= now() - interval '7 days') AS updated_files,
          COUNT(*) FILTER (WHERE updated_at < now() - interval '30 days') AS stale_files
        FROM mx_file
        ${fileWhere.where}
        GROUP BY normalized_path
      `,
      fileWhere.values,
    ),
  ])

  return buildTreeResponse(accessRows, revisionRows, eventRows, fileRows)
}

export async function getObservabilityTreeNode(db: Db, normalizedPath: string, input: ObservabilityFilters = {}) {
  const scoped = { ...input, normalizedPath }
  const tree = await getObservabilityTree(db, scoped)
  const node = tree.nodes.find((item) => item.normalizedPath === normalizedPath) ?? tree.selectedNode ?? null
  const access = buildAccessWhere(scoped)
  const accessWhere = prefixWhere(access.where, "l")
  const bucket = bucketExpr(input.bucket)

  const [
    { rows: concreteRows },
    { rows: scopeRows },
    { rows: coHitRows },
    { rows: activityRows },
  ] = await Promise.all([
    db.query<{ physical_path: string; hits: string; last_accessed_at: Date | null }>(
      `
        SELECT l.physical_path, COUNT(*) AS hits, MAX(l.created_at) AS last_accessed_at
        FROM mx_access_log l
        ${accessWhere}
        GROUP BY l.physical_path
        ORDER BY hits DESC, last_accessed_at DESC
        LIMIT 10
      `,
      access.values,
    ),
    db.query<{ user_id: string | null; hits: string; last_accessed_at: Date | null }>(
      `
        SELECT l.user_id, COUNT(*) AS hits, MAX(l.created_at) AS last_accessed_at
        FROM mx_access_log l
        ${accessWhere}
        GROUP BY l.user_id
        ORDER BY hits DESC, last_accessed_at DESC
        LIMIT 10
      `,
      access.values,
    ),
    db.query<{ normalized_path: string; count: string; last_seen_at: Date | null }>(
      `
        SELECT ${normalizedPathExpr("other.physical_path")} AS normalized_path, COUNT(*) AS count, MAX(other.created_at) AS last_seen_at
        FROM mx_access_log base
        JOIN mx_access_log other ON other.tool_call_id = base.tool_call_id
          AND other.tool_call_id IS NOT NULL
          AND other.physical_path <> base.physical_path
        ${prefixWhere(access.where, "base")}
        GROUP BY normalized_path
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
      access.values,
    ),
    db.query<{
      bucket_start: Date
      reads: string
      writes: string
      searches: string
      smart_reads: string
    }>(
      `
        SELECT
          ${bucket.replaceAll("created_at", "l.created_at")} AS bucket_start,
          COUNT(*) FILTER (WHERE l.operation = 'read') AS reads,
          COUNT(*) FILTER (WHERE l.operation IN ('write', 'patch')) AS writes,
          COUNT(*) FILTER (WHERE l.operation IN ('search', 'find')) AS searches,
          COUNT(*) FILTER (WHERE l.operation IN ('smart_read', 'context')) AS smart_reads
        FROM mx_access_log l
        ${accessWhere}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      access.values,
    ),
  ])

  return {
    node,
    topConcretePaths: concreteRows.map((row) => ({
      physicalPath: row.physical_path,
      count: toNumber(row.hits),
      lastSeenAt: row.last_accessed_at,
    })),
    topScopes: scopeRows.map((row) => ({
      userId: row.user_id,
      count: toNumber(row.hits),
      lastSeenAt: row.last_accessed_at,
    })),
    coHitNodes: coHitRows.map((row) => ({
      normalizedPath: row.normalized_path,
      count: toNumber(row.count),
      lastSeenAt: row.last_seen_at,
    })),
    activity: activityRows.map((row) => ({
      bucketStart: row.bucket_start,
      reads: toNumber(row.reads),
      writes: toNumber(row.writes),
      searches: toNumber(row.searches),
      smartReads: toNumber(row.smart_reads),
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
    trace_id: string | null
    span_id: string | null
    parent_span_id: string | null
    attributes: Record<string, unknown>
    created_at: Date
  }>(
    `
      SELECT id, event_type, status, duration_ms, user_id, actor, tool_name, operation,
             physical_path, tool_call_id, error_code, trace_id, span_id, parent_span_id,
             attributes, created_at
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
      traceId: row.trace_id,
      spanId: row.span_id,
      parentSpanId: row.parent_span_id,
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
          COUNT(*) FILTER (WHERE operation IN ('search', 'find', 'smart_read', 'context')) AS searches
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
  const accessJoin = accessWhere ? accessWhere.replace(/^WHERE /, "AND ") : ""
  const coHitWhere = prefixWhere(access.where, "a")

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
        LEFT JOIN mx_access_log l ON l.physical_path = f.physical_path AND l.operation = 'read' ${accessJoin}
        GROUP BY f.physical_path, f.content_text, f.updated_at
        HAVING COUNT(l.id) = 0
        ORDER BY f.updated_at ASC
        LIMIT 8
      `,
      values,
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
        ${coHitWhere}
        GROUP BY a.physical_path, b.physical_path
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
      values,
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
        ${access.where ? `${access.where} AND` : "WHERE"} physical_path LIKE 'shared/%'
        GROUP BY physical_path
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
      values,
    ),
    db.query<{
      user_id: string | null
      count: string
      last_seen_at: Date | null
    }>(
      `
        SELECT user_id, COUNT(*) AS count, MAX(created_at) AS last_seen_at
        FROM mx_access_log
        ${access.where ? `${access.where} AND` : "WHERE"} operation IN ('search', 'find', 'smart_read', 'context')
        GROUP BY user_id
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
      values,
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

export async function getFileObservability(db: Db, physicalPath: string, input: ObservabilityFilters = {}) {
  const scoped = { ...input, physicalPath }
  const access = buildAccessWhere(scoped)
  const bucket = bucketExpr(input.bucket)

  const [
    { rows: summaryRows },
    { rows: activityRows },
    { rows: userRows },
    { rows: coHitRows },
    { rows: eventRows },
  ] = await Promise.all([
    db.query<{
      reads: string
      writes: string
      searches: string
      smart_reads: string
      unique_users: string
      last_accessed_at: Date | null
      last_written_at: Date | null
      revisions: string
      p95_ms: string | number | null
    }>(
      `
        WITH file_access AS (
          SELECT * FROM mx_access_log ${access.where}
        ),
        related_events AS (
          SELECT e.duration_ms
          FROM mx_observation_event e
          WHERE e.duration_ms IS NOT NULL
            AND (
              e.physical_path = $${access.values.length + 1}
              OR EXISTS (
                SELECT 1 FROM mx_access_log l
                WHERE l.physical_path = $${access.values.length + 1}
                  AND l.tool_call_id IS NOT NULL
                  AND l.tool_call_id = e.tool_call_id
              )
            )
        )
        SELECT
          COUNT(*) FILTER (WHERE operation = 'read') AS reads,
          COUNT(*) FILTER (WHERE operation IN ('write', 'patch')) AS writes,
          COUNT(*) FILTER (WHERE operation IN ('search', 'find')) AS searches,
          COUNT(*) FILTER (WHERE operation IN ('smart_read', 'context')) AS smart_reads,
          COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS unique_users,
          MAX(created_at) AS last_accessed_at,
          MAX(created_at) FILTER (WHERE operation IN ('write', 'patch')) AS last_written_at,
          (SELECT COUNT(*) FROM mx_revision WHERE physical_path = $${access.values.length + 1}) AS revisions,
          (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FROM related_events) AS p95_ms
        FROM file_access
      `,
      [...access.values, physicalPath],
    ),
    db.query<{
      bucket_start: Date
      reads: string
      writes: string
      searches: string
      smart_reads: string
    }>(
      `
        SELECT
          ${bucket} AS bucket_start,
          COUNT(*) FILTER (WHERE operation = 'read') AS reads,
          COUNT(*) FILTER (WHERE operation IN ('write', 'patch')) AS writes,
          COUNT(*) FILTER (WHERE operation IN ('search', 'find')) AS searches,
          COUNT(*) FILTER (WHERE operation IN ('smart_read', 'context')) AS smart_reads
        FROM mx_access_log
        ${access.where}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      access.values,
    ),
    db.query<{
      user_id: string | null
      reads: string
      writes: string
      searches: string
      last_accessed_at: Date | null
    }>(
      `
        SELECT
          user_id,
          COUNT(*) FILTER (WHERE operation = 'read') AS reads,
          COUNT(*) FILTER (WHERE operation IN ('write', 'patch')) AS writes,
          COUNT(*) FILTER (WHERE operation IN ('search', 'find', 'smart_read', 'context')) AS searches,
          MAX(created_at) AS last_accessed_at
        FROM mx_access_log
        ${access.where}
        GROUP BY user_id
        ORDER BY COUNT(*) DESC, last_accessed_at DESC
        LIMIT 20
      `,
      access.values,
    ),
    db.query<{
      physical_path: string
      count: string
      last_seen_at: Date | null
    }>(
      `
        SELECT other.physical_path, COUNT(*) AS count, MAX(other.created_at) AS last_seen_at
        FROM mx_access_log base
        JOIN mx_access_log other ON other.tool_call_id = base.tool_call_id
          AND other.tool_call_id IS NOT NULL
          AND other.physical_path <> base.physical_path
        WHERE base.physical_path = $1
        GROUP BY other.physical_path
        ORDER BY count DESC, last_seen_at DESC
        LIMIT 8
      `,
      [physicalPath],
    ),
    db.query<{
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
        SELECT e.id, e.event_type, e.status, e.duration_ms, e.user_id, e.actor, e.tool_name,
               e.operation, e.physical_path, e.tool_call_id, e.error_code, e.attributes, e.created_at
        FROM mx_observation_event e
        WHERE e.physical_path = $1
          OR EXISTS (
            SELECT 1 FROM mx_access_log l
            WHERE l.physical_path = $1
              AND l.tool_call_id IS NOT NULL
              AND l.tool_call_id = e.tool_call_id
          )
        ORDER BY e.created_at DESC
        LIMIT 20
      `,
      [physicalPath],
    ),
  ])

  const summary = summaryRows[0]
  return {
    summary: {
      reads: toNumber(summary?.reads),
      writes: toNumber(summary?.writes),
      searches: toNumber(summary?.searches),
      smartReads: toNumber(summary?.smart_reads),
      revisions: toNumber(summary?.revisions),
      uniqueUsers: toNumber(summary?.unique_users),
      lastAccessedAt: summary?.last_accessed_at ?? null,
      lastWrittenAt: summary?.last_written_at ?? null,
      p95Ms: nullableNumber(summary?.p95_ms),
    },
    activity: activityRows.map((row) => ({
      bucketStart: row.bucket_start,
      reads: toNumber(row.reads),
      writes: toNumber(row.writes),
      searches: toNumber(row.searches),
      smartReads: toNumber(row.smart_reads),
    })),
    topUsers: userRows.map((row) => ({
      userId: row.user_id,
      reads: toNumber(row.reads),
      writes: toNumber(row.writes),
      searches: toNumber(row.searches),
      lastAccessedAt: row.last_accessed_at,
    })),
    coHitFiles: coHitRows.map((row) => ({
      physicalPath: row.physical_path,
      count: toNumber(row.count),
      lastSeenAt: row.last_seen_at,
    })),
    recentEvents: eventRows.map((row) => ({
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
    physicalPath: normalizeMemoryPath(row.physical_path),
    size: nullableNumber(row.size),
    count: toNumber(row.count),
    lastSeenAt: row.last_seen_at,
  }
}

type TreeAccessRow = {
  normalized_path: string
  reads: string
  writes: string
  searches: string
  smart_reads: string
  total_hits: string
  unique_users: string
  user_ids: string[] | null
  size: string | number | null
  last_accessed_at: Date | null
}

type TreeNodeMetric = {
  normalizedPath: string
  label: string
  parentPath: string | null
  kind: "folder" | "file"
  depth: number
  reads: number
  writes: number
  searches: number
  smartReads: number
  totalHits: number
  uniqueUsers: number
  revisions: number
  files: number
  size: number | null
  p95Ms: number | null
  errors: number
  newFiles: number
  updatedFiles: number
  staleFiles: number
  lastAccessedAt: Date | null
  badges: string[]
}

function buildTreeResponse(
  accessRows: TreeAccessRow[],
  revisionRows: Array<{ normalized_path: string; revisions: string; last_revised_at: Date | null }>,
  eventRows: Array<{ normalized_path: string; errors: string; p95_ms: string | number | null }>,
  fileRows: Array<{ normalized_path: string; files: string; new_files: string; updated_files: string; stale_files: string }>,
) {
  const nodes = new Map<string, TreeNodeMetric>()
  const userSets = new Map<string, Set<string>>()

  const ensureNode = (normalizedPath: string, kind: "folder" | "file") => {
    const clean = normalizedPath.replace(/\/$/, "")
    const existing = nodes.get(clean)
    if (existing) {
      if (kind === "file") existing.kind = "file"
      return existing
    }
    const parts = clean.split("/").filter(Boolean)
    const node: TreeNodeMetric = {
      normalizedPath: clean,
      label: parts.at(-1) ?? clean,
      parentPath: parts.length > 1 ? parts.slice(0, -1).join("/") : null,
      kind,
      depth: Math.max(0, parts.length - 1),
      reads: 0,
      writes: 0,
      searches: 0,
      smartReads: 0,
      totalHits: 0,
      uniqueUsers: 0,
      revisions: 0,
      files: 0,
      size: null,
      p95Ms: null,
      errors: 0,
      newFiles: 0,
      updatedFiles: 0,
      staleFiles: 0,
      lastAccessedAt: null,
      badges: [],
    }
    nodes.set(clean, node)
    if (node.parentPath) ensureNode(node.parentPath, "folder")
    return node
  }

  const addUsers = (path: string, users: string[] | null | undefined) => {
    if (!users?.length) return
    const userSet = userSets.get(path) ?? new Set<string>()
    for (const user of users) userSet.add(user)
    userSets.set(path, userSet)
    const node = nodes.get(path)
    if (node) node.uniqueUsers = userSet.size
  }

  for (const row of accessRows) {
    const normalizedPath = row.normalized_path
    const leaf = ensureNode(normalizedPath, "file")
    leaf.reads += toNumber(row.reads)
    leaf.writes += toNumber(row.writes)
    leaf.searches += toNumber(row.searches)
    leaf.smartReads += toNumber(row.smart_reads)
    leaf.totalHits += toNumber(row.total_hits)
    addUsers(normalizedPath, row.user_ids)
    leaf.size = nullableNumber(row.size)
    leaf.lastAccessedAt = maxDate(leaf.lastAccessedAt, row.last_accessed_at)

    for (const parent of ancestorPaths(normalizedPath)) {
      const node = ensureNode(parent, "folder")
      node.reads += toNumber(row.reads)
      node.writes += toNumber(row.writes)
      node.searches += toNumber(row.searches)
      node.smartReads += toNumber(row.smart_reads)
      node.totalHits += toNumber(row.total_hits)
      addUsers(parent, row.user_ids)
      node.lastAccessedAt = maxDate(node.lastAccessedAt, row.last_accessed_at)
    }
  }

  for (const row of revisionRows) {
    for (const path of [row.normalized_path, ...ancestorPaths(row.normalized_path)]) {
      const node = ensureNode(path, path === row.normalized_path ? "file" : "folder")
      node.revisions += toNumber(row.revisions)
    }
  }

  for (const row of eventRows) {
    if (!row.normalized_path) continue
    for (const path of [row.normalized_path, ...ancestorPaths(row.normalized_path)]) {
      const node = ensureNode(path, path === row.normalized_path ? "file" : "folder")
      node.errors += toNumber(row.errors)
      node.p95Ms = maxNullable(node.p95Ms, nullableNumber(row.p95_ms))
    }
  }

  for (const row of fileRows) {
    for (const path of [row.normalized_path, ...ancestorPaths(row.normalized_path)]) {
      const node = ensureNode(path, path === row.normalized_path ? "file" : "folder")
      node.files += toNumber(row.files)
      node.newFiles += toNumber(row.new_files)
      node.updatedFiles += toNumber(row.updated_files)
      node.staleFiles += toNumber(row.stale_files)
    }
  }

  const nodeList = [...nodes.values()]
    .filter((node) => node.normalizedPath)
    .map((node) => ({ ...node, badges: badgesForNode(node) }))
    .sort((a, b) => {
      if (a.parentPath !== b.parentPath) return String(a.parentPath ?? "").localeCompare(String(b.parentPath ?? ""))
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
      return b.totalHits - a.totalHits || a.label.localeCompare(b.label)
    })

  const hotFiles = nodeList.filter((node) => node.kind === "file" && node.totalHits > 0).sort((a, b) => b.totalHits - a.totalHits)
  const coldFiles = nodeList.filter((node) => node.kind === "file" && node.totalHits === 0 && node.files > 0)
  const highChurn = nodeList.filter((node) => node.kind === "file" && node.revisions > 2).sort((a, b) => b.revisions - a.revisions)
  const hotLargeFiles = hotFiles.filter((node) => (node.size ?? 0) >= 1000)
  const searchHeavy = nodeList.filter((node) => node.searches + node.smartReads > 0).sort((a, b) => (b.searches + b.smartReads) - (a.searches + a.smartReads))
  const sharedUsage = nodeList.filter((node) => node.kind === "file" && node.normalizedPath.startsWith("shared/") && node.totalHits > 0).sort((a, b) => b.totalHits - a.totalHits)

  return {
    nodes: nodeList,
    summary: {
      hotFiles: hotFiles.length,
      coldFiles: coldFiles.length,
      highChurn: highChurn.length,
      hotLargeFiles: hotLargeFiles.length,
      searchHeavy: searchHeavy.length,
      revisions: nodeList.filter((node) => node.depth === 0).reduce((sum, node) => sum + node.revisions, 0),
      newFiles: nodeList.filter((node) => node.depth === 0).reduce((sum, node) => sum + node.newFiles, 0),
      updatedFiles: nodeList.filter((node) => node.depth === 0).reduce((sum, node) => sum + node.updatedFiles, 0),
      staleFiles: nodeList.filter((node) => node.depth === 0).reduce((sum, node) => sum + node.staleFiles, 0),
    },
    hygiene: {
      hotFiles: hotFiles.slice(0, 8),
      coldFiles: coldFiles.slice(0, 8),
      highChurn: highChurn.slice(0, 8),
      hotLargeFiles: hotLargeFiles.slice(0, 8),
      searchHeavy: searchHeavy.slice(0, 8),
      sharedUsage: sharedUsage.slice(0, 8),
    },
    selectedNode: nodeList[0] ?? null,
  }
}

function badgesForNode(node: TreeNodeMetric): string[] {
  const badges: string[] = []
  if (node.totalHits >= 10) badges.push("hot")
  if (node.errors > 0 || (node.p95Ms ?? 0) >= 1000) badges.push("risk")
  if (node.revisions > 2) badges.push("churn")
  if ((node.size ?? 0) >= 1000 && node.totalHits > 0) badges.push("large")
  if (node.totalHits === 0 && node.files > 0) badges.push("cold")
  return badges
}

function ancestorPaths(path: string): string[] {
  const parts = path.split("/").filter(Boolean)
  const ancestors: string[] = []
  for (let index = parts.length - 1; index > 0; index -= 1) {
    ancestors.push(parts.slice(0, index).join("/"))
  }
  return ancestors
}

function maxDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b
  if (!b) return a
  return a > b ? a : b
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.max(a, b)
}

function buildObservationWhere(input: ObservabilityFilters) {
  const values: unknown[] = []
  const filters: string[] = []
  addDateFilter(filters, values, "created_at", ">=", input.from)
  addDateFilter(filters, values, "created_at", "<=", input.to)
  addTextFilter(filters, values, "user_id", input.userId)
  addObservationPathFilter(filters, values, input.physicalPath)
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
  addNormalizedPathFilter(filters, values, "physical_path", input.normalizedPath)
  addTextFilter(filters, values, "physical_path", input.physicalPath)
  addTextFilter(filters, values, "operation", input.operation)
  addTextFilter(filters, values, "actor", input.actor)
  addAccessObservationFilter(filters, values, input)
  return { where: filters.length ? `WHERE ${filters.join(" AND ")}` : "", values }
}

function buildRevisionWhere(input: ObservabilityFilters) {
  const values: unknown[] = []
  const filters: string[] = []
  addDateFilter(filters, values, "created_at", ">=", input.from)
  addDateFilter(filters, values, "created_at", "<=", input.to)
  addTextFilter(filters, values, "user_id", input.userId)
  addNormalizedPathFilter(filters, values, "physical_path", input.normalizedPath)
  addTextFilter(filters, values, "actor", input.actor)
  return { where: filters.length ? `WHERE ${filters.join(" AND ")}` : "", values }
}

function buildFileWhere(input: ObservabilityFilters) {
  const values: unknown[] = []
  const filters: string[] = []
  addTextFilter(filters, values, "physical_path", input.physicalPath)
  addNormalizedPathFilter(filters, values, "physical_path", input.normalizedPath)
  if (input.userId?.trim()) {
    values.push(`users/${input.userId.trim()}/%`)
    filters.push(`physical_path LIKE $${values.length}`)
  }
  return { where: filters.length ? `WHERE ${filters.join(" AND ")}` : "", values }
}

function addTextFilter(filters: string[], values: unknown[], column: string, value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return
  values.push(trimmed)
  filters.push(`${column} = $${values.length}`)
}

function addNormalizedPathFilter(filters: string[], values: unknown[], column: string, value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return
  values.push(trimmed)
  filters.push(`${normalizedPathExpr(column)} = $${values.length}`)
}

function addObservationPathFilter(filters: string[], values: unknown[], value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return
  values.push(trimmed)
  filters.push(`(
    physical_path = $${values.length}
    OR tool_call_id IN (
      SELECT tool_call_id
      FROM mx_access_log
      WHERE physical_path = $${values.length}
        AND tool_call_id IS NOT NULL
    )
  )`)
}

function addAccessObservationFilter(filters: string[], values: unknown[], input: ObservabilityFilters) {
  const observationFilters: string[] = ["e.tool_call_id = mx_access_log.tool_call_id", "e.tool_call_id IS NOT NULL"]
  const toolName = input.toolName?.trim()
  const status = input.status?.trim()
  if (!toolName && !status) return
  if (toolName) {
    values.push(toolName)
    observationFilters.push(`e.tool_name = $${values.length}`)
  }
  if (status) {
    values.push(status)
    observationFilters.push(`e.status = $${values.length}`)
  }
  filters.push(`EXISTS (SELECT 1 FROM mx_observation_event e WHERE ${observationFilters.join(" AND ")})`)
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
  const columns = ["physical_path", "created_at", "user_id", "operation", "actor"]
  let qualified = where.replaceAll("mx_access_log.", `${alias}.`)
  for (const column of columns) {
    qualified = qualified.replace(new RegExp(`(?<![.\\w])${column}\\b`, "g"), `${alias}.${column}`)
  }
  return qualified
}

function normalizedPathExpr(column: string): string {
  return `CASE
    WHEN ${column} = '*' THEN 'activity/search'
    WHEN ${column} LIKE 'users/%/%' THEN 'users/' || substring(${column} from '^users/[^/]+/(.*)$')
    ELSE ${column}
  END`
}

function normalizeMemoryPath(path: string): string {
  if (path === "*") return "activity/search"
  const match = path.match(/^users\/[^/]+\/(.+)$/)
  return match ? `users/${match[1]}` : path
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
