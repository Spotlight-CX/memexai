import { randomUUID } from "node:crypto"
import type { Config } from "./config"
import type { Db } from "./db"

export const POSTHOG_KEY = "phc_bv7z3layK9wvAFUY8nUbhcqirWNiOTsy0KSZS2M83Mc"
export const POSTHOG_HOST = "https://us.i.posthog.com"

export type TelemetryEvent =
  | "service_started"
  | "tool_executed"
  | "prompt_block_requested"
  | "mcp_session_started"
  | "dream_cycle_run"
  | "admin_route_used"

export type TelemetryProperties = Record<string, string | number | boolean | null | undefined>

export type TelemetryClient = {
  enabled: boolean
  distinctId: string
  capture(event: TelemetryEvent, properties?: TelemetryProperties): void
  flush(): Promise<void>
}

type CapturePayload = {
  api_key: string
  event: TelemetryEvent
  distinct_id: string
  properties: TelemetryProperties
}

type FetchLike = (url: string, init: {
  method: "POST"
  headers: Record<string, string>
  body: string
}) => Promise<unknown>

const allowedProperties = new Set([
  "admin_route_group",
  "deployment",
  "dream_enabled",
  "duration_bucket",
  "error_code",
  "files_touched_bucket",
  "mcp_available",
  "model_provider",
  "node_env",
  "route_kind",
  "service_version",
  "status",
  "success",
  "tool_name",
  "transport",
])

export function sanitizeTelemetryProperties(input: TelemetryProperties = {}): TelemetryProperties {
  const clean: TelemetryProperties = {}
  for (const [key, value] of Object.entries(input)) {
    if (!allowedProperties.has(key)) continue
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      clean[key] = value
    }
  }
  return clean
}

export function durationBucket(ms: number): string {
  if (ms < 100) return "lt_100ms"
  if (ms < 500) return "100_499ms"
  if (ms < 1000) return "500_999ms"
  if (ms < 5000) return "1_5s"
  return "gt_5s"
}

export function countBucket(count: number): string {
  if (count <= 0) return "0"
  if (count === 1) return "1"
  if (count <= 5) return "2_5"
  if (count <= 20) return "6_20"
  return "gt_20"
}

export async function createTelemetryClient(input: {
  config: Config
  db?: Db
  serviceVersion?: string
  fetch?: FetchLike
}): Promise<TelemetryClient> {
  const disabled = input.config.MEMEX_TELEMETRY_DISABLED
  const key = input.config.MEMEX_TELEMETRY_POSTHOG_KEY ?? POSTHOG_KEY
  const host = (input.config.MEMEX_TELEMETRY_POSTHOG_HOST ?? POSTHOG_HOST).replace(/\/+$/, "")
  const distinctId = await readOrCreateTelemetryInstanceId(input.db)

  if (disabled || !key || key.includes("REPLACE_WITH")) {
    return createNoopTelemetry(distinctId)
  }

  const fetchImpl = input.fetch ?? fetch
  const pending = new Set<Promise<unknown>>()

  return {
    enabled: true,
    distinctId,
    capture(event, properties = {}) {
      try {
        const payload: CapturePayload = {
          api_key: key,
          event,
          distinct_id: distinctId,
          properties: sanitizeTelemetryProperties({
            service_version: input.serviceVersion,
            ...properties,
          }),
        }
        const request = Promise.resolve(fetchImpl(`${host}/capture/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })).catch(() => undefined).finally(() => {
          pending.delete(request)
        })
        pending.add(request)
      } catch {
        // Telemetry must never affect service behavior.
      }
    },
    async flush() {
      await Promise.allSettled([...pending])
    },
  }
}

export function createNoopTelemetry(distinctId = `memex_${randomUUID()}`): TelemetryClient {
  return {
    enabled: false,
    distinctId,
    capture() {},
    async flush() {},
  }
}

async function readOrCreateTelemetryInstanceId(db?: Db): Promise<string> {
  if (!db) return `memex_${randomUUID()}`

  try {
    const id = `memex_${randomUUID()}`
    const { rows } = await db.query<{ value: string }>(
      `
        INSERT INTO mx_config (key, value, description, updated_at)
        VALUES ('telemetry_instance_id', $1, 'Anonymous stable service telemetry instance id', now())
        ON CONFLICT (key)
        DO UPDATE SET value = mx_config.value
        RETURNING value
      `,
      [id],
    )
    return rows[0]?.value ?? id
  } catch {
    return `memex_${randomUUID()}`
  }
}
