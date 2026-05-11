import type pg from "pg"

type Db = pg.Pool

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`
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

export async function listAdminUsers(db: Db) {
  const { rows } = await db.query<{
    user_id: string
    file_count: string
    last_write_at: Date | null
    last_read_at: Date | null
  }>(`
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
    ORDER BY user_files.last_write_at DESC NULLS LAST, user_files.user_id ASC
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
  if (!file) return null

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

export async function writeAdminFile(db: Db, physicalPath: string, content: string, reason?: string) {
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
