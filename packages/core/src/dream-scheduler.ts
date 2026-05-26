import type { Db } from "./db"
import { DREAM_EXCLUDED_PATHS, isDreamExcludedPath } from "./dream-paths"
import { newId } from "./ids"
import type { ToolContext } from "./paths"
import { executeMemoryConsolidate } from "./tools"

export { DREAM_EXCLUDED_PATHS, isDreamExcludedPath }

export type DreamConfig = {
  enabled: boolean
  intervalMinutes: number
  gracePeriodMinutes: number
  maxWrites: number
  concurrency: number
}

const DEFAULT_DREAM_CONFIG: DreamConfig = {
  enabled: false,
  intervalMinutes: 60,
  gracePeriodMinutes: 30,
  maxWrites: 10,
  concurrency: 3,
}

export async function readDreamConfig(db: Db): Promise<DreamConfig> {
  const { rows } = await db.query<{ key: string; value: string }>(
    "SELECT key, value FROM mx_config WHERE key LIKE 'dream_%'",
  )
  const values = new Map(rows.map((row) => [row.key, row.value]))
  return {
    enabled: values.get("dream_enabled") === "true",
    intervalMinutes: readPositiveInt(values, "dream_interval_minutes", DEFAULT_DREAM_CONFIG.intervalMinutes),
    gracePeriodMinutes: readPositiveInt(values, "dream_grace_period_minutes", DEFAULT_DREAM_CONFIG.gracePeriodMinutes),
    maxWrites: readPositiveInt(values, "dream_max_writes", DEFAULT_DREAM_CONFIG.maxWrites),
    concurrency: readPositiveInt(values, "dream_concurrency", DEFAULT_DREAM_CONFIG.concurrency),
  }
}

function readPositiveInt(values: Map<string, string>, key: string, fallback: number): number {
  const parsed = Number(values.get(key))
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export async function selectUsersToDream(db: Db, options: { gracePeriodMinutes?: number } = {}): Promise<string[]> {
  const gracePeriodMinutes = options.gracePeriodMinutes ?? DEFAULT_DREAM_CONFIG.gracePeriodMinutes
  const { rows } = await db.query<{ user_id: string }>(
    `
      WITH user_writes AS (
        SELECT
          (regexp_match(physical_path, '^users/([^/]+)/'))[1] AS user_id,
          max(updated_at) AS last_write_at
        FROM mx_file
        WHERE physical_path LIKE 'users/%/%'
          AND physical_path NOT LIKE 'users/%/dream-log.md'
          AND physical_path NOT LIKE 'users/%/log.md'
          AND physical_path NOT LIKE 'users/%/%-log.md'
          AND physical_path NOT LIKE 'users/%/%.log'
        GROUP BY user_id
      )
      SELECT user_writes.user_id
      FROM user_writes
      LEFT JOIN mx_dream_run ON mx_dream_run.user_id = user_writes.user_id
      WHERE user_writes.user_id IS NOT NULL
        AND user_writes.last_write_at < now() - ($1::int * interval '1 minute')
        AND (mx_dream_run.last_dreamed_at IS NULL OR user_writes.last_write_at > mx_dream_run.last_dreamed_at)
        AND coalesce(mx_dream_run.paused, false) = false
        AND coalesce(mx_dream_run.status, 'idle') <> 'running'
      ORDER BY user_writes.last_write_at ASC
    `,
    [gracePeriodMinutes],
  )
  return rows.map((row) => row.user_id)
}

export async function resetStaleDreamRuns(db: Db): Promise<void> {
  await db.query(
    `
      UPDATE mx_dream_run
      SET status = 'idle', error = NULL, updated_at = now()
      WHERE status = 'running'
        AND last_started_at < now() - interval '10 minutes'
    `,
  )
}

export async function runDreamCycle(
  db: Db,
  config: DreamConfig,
  options: { model: unknown },
): Promise<void> {
  if (!config.enabled) return
  await resetStaleDreamRuns(db)
  const userIds = await selectUsersToDream(db, { gracePeriodMinutes: config.gracePeriodMinutes })
  if (userIds.length === 0) {
    console.log("MemexAI dream cycle: no users with pending writes, skipping")
    return
  }
  const concurrency = Math.max(1, config.concurrency)

  for (let index = 0; index < userIds.length; index += concurrency) {
    const batch = userIds.slice(index, index + concurrency)
    await Promise.allSettled(batch.map((userId) => runUserDream(db, userId, config, options.model)))
  }
}

async function runUserDream(db: Db, userId: string, config: DreamConfig, model: unknown): Promise<void> {
  await markDreamRunning(db, userId)
  const ctx: ToolContext = { userId, actor: "dream-agent" }

  try {
    const result = await executeMemoryConsolidate(db, ctx, { model, maxWrites: config.maxWrites })
    await db.query(
      `
        UPDATE mx_dream_run
        SET status = 'completed',
            last_dreamed_at = now(),
            files_touched = $2,
            error = NULL,
            dream_count = dream_count + 1,
            updated_at = now()
        WHERE user_id = $1
      `,
      [userId, result.filesTouched.filter((path) => !isDreamExcludedPath(path)).length],
    )
  } catch (error) {
    await db.query(
      `
        UPDATE mx_dream_run
        SET status = 'failed',
            error = $2,
            updated_at = now()
        WHERE user_id = $1
      `,
      [userId, error instanceof Error ? error.message : String(error)],
    )
    throw error
  }
}

async function markDreamRunning(db: Db, userId: string): Promise<void> {
  await db.query(
    `
      INSERT INTO mx_dream_run (id, user_id, status, last_started_at, error)
      VALUES ($1, $2, 'running', now(), NULL)
      ON CONFLICT (user_id)
      DO UPDATE SET status = 'running',
                    last_started_at = now(),
                    error = NULL,
                    updated_at = now()
    `,
    [newId("dream"), userId],
  )
}
