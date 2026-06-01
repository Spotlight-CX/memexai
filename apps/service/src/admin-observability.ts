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
