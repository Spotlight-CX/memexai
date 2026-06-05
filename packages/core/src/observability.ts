import { AsyncLocalStorage } from "node:async_hooks"
import type { Db } from "./db"
import { newId } from "./ids"
import type { ToolContext } from "./paths"

export type ObservationStatus = "success" | "error"

export type ObservationEventInput = {
  eventType: "tool_execution" | "tool_span" | "prompt_block" | "admin_route" | "dream_run" | "mcp_session"
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

export type ObservationUsage = {
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
}

export type ObservationSearchStats = {
  searchMode?: "bm25" | "hybrid" | "agentic"
  candidateCount?: number
  filesReturned?: number
  filesRead?: number
  sourcesReturned?: number
}

type ObservationScope = {
  traceId: string
  rootSpanId: string
  currentSpanId: string
  toolCallId: string
  userId: string
  actor?: string | null
}

const observationStore = new AsyncLocalStorage<ObservationScope>()

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
  "route_kind",
  "rrf_k",
  "search_mode",
  "sources_returned",
  "total_tokens",
  "truncated",
  "updated",
  "vector_candidate_limit",
  "write_count",
])

export function currentObservationScope(): ObservationScope | undefined {
  return observationStore.getStore()
}

export function contextWithTrace(ctx: ToolContext): ToolContext {
  const scope = currentObservationScope()
  if (!scope) return ctx
  return { ...ctx, toolCallId: scope.toolCallId }
}

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
    // Local observability must never affect memory behavior.
  }
}

export async function withRootObservation<T>(
  db: Db,
  input: {
    ctx: ToolContext
    toolName: string
    operation: string | null
    attributes?: Record<string, unknown>
  },
  fn: (ctx: ToolContext) => Promise<T>,
): Promise<T & Record<string, unknown>> {
  const traceId = input.ctx.traceId ?? newId("trace")
  const rootSpanId = newId("span")
  const toolCallId = input.ctx.toolCallId ?? newId("tool")
  const ctx = { ...input.ctx, toolCallId, traceId }
  const started = Date.now()
  const scope: ObservationScope = {
    traceId,
    rootSpanId,
    currentSpanId: rootSpanId,
    toolCallId,
    userId: ctx.userId,
    actor: ctx.actor ?? null,
  }

  return observationStore.run(scope, async () => {
    try {
      const result = await fn(ctx)
      const durationMs = Date.now() - started
      const usage = usageFromResult(result)
      const searchStats = searchStatsFromResult(result)
      await recordObservationEvent(db, {
        eventType: "tool_execution",
        status: "success",
        durationMs,
        userId: ctx.userId,
        actor: ctx.actor,
        toolName: input.toolName,
        operation: input.operation,
        toolCallId,
        traceId,
        spanId: rootSpanId,
        attributes: {
          ...input.attributes,
          ...usageAttributes(usage),
          ...searchStatsAttributes(searchStats),
          ...observationAttributesForResult(result),
        },
      })
      return decorateToolResult(result, { traceId, toolCallId, durationMs, usage, searchStats }) as T & Record<string, unknown>
    } catch (error) {
      const durationMs = Date.now() - started
      await recordObservationEvent(db, {
        eventType: "tool_execution",
        status: "error",
        durationMs,
        userId: ctx.userId,
        actor: ctx.actor,
        toolName: input.toolName,
        operation: input.operation,
        toolCallId,
        errorCode: errorCode(error),
        traceId,
        spanId: rootSpanId,
        attributes: input.attributes,
      })
      throw error
    }
  })
}

export async function withObservationSpan<T>(
  db: Db,
  input: {
    name: string
    operation?: string | null
    physicalPath?: string | null
    attributes?: Record<string, unknown>
  },
  fn: () => Promise<T>,
): Promise<T> {
  const parent = currentObservationScope()
  if (!parent) return fn()
  const spanId = newId("span")
  const started = Date.now()
  const nextScope = { ...parent, currentSpanId: spanId }
  return observationStore.run(nextScope, async () => {
    try {
      const result = await fn()
      await recordObservationEvent(db, {
        eventType: "tool_span",
        status: "success",
        durationMs: Date.now() - started,
        userId: parent.userId,
        actor: parent.actor,
        toolName: input.name,
        operation: input.operation ?? null,
        physicalPath: input.physicalPath ?? null,
        toolCallId: parent.toolCallId,
        traceId: parent.traceId,
        spanId,
        parentSpanId: parent.currentSpanId,
        attributes: {
          ...input.attributes,
          ...observationAttributesForResult(result),
        },
      })
      return result
    } catch (error) {
      await recordObservationEvent(db, {
        eventType: "tool_span",
        status: "error",
        durationMs: Date.now() - started,
        userId: parent.userId,
        actor: parent.actor,
        toolName: input.name,
        operation: input.operation ?? null,
        physicalPath: input.physicalPath ?? null,
        toolCallId: parent.toolCallId,
        errorCode: errorCode(error),
        traceId: parent.traceId,
        spanId,
        parentSpanId: parent.currentSpanId,
        attributes: input.attributes,
      })
      throw error
    }
  })
}

export function usageFromGenerateTextResult(result: unknown): ObservationUsage | undefined {
  if (!result || typeof result !== "object") return undefined
  const value = result as Record<string, unknown>
  const usage = value.usage
  if (!usage || typeof usage !== "object") return undefined
  return usageFromRecord(usage as Record<string, unknown>)
}

function usageFromResult(result: unknown): ObservationUsage | undefined {
  if (!result || typeof result !== "object") return undefined
  const value = result as Record<string, unknown>
  const usage = value.usage
  if (!usage || typeof usage !== "object") return undefined
  return usageFromRecord(usage as Record<string, unknown>)
}

function usageFromRecord(value: Record<string, unknown>): ObservationUsage | undefined {
  const inputTokens = numberFromUnknown(value.inputTokens ?? value.promptTokens)
  const outputTokens = numberFromUnknown(value.outputTokens ?? value.completionTokens)
  const totalTokens = numberFromUnknown(value.totalTokens)
    ?? (inputTokens !== null || outputTokens !== null ? (inputTokens ?? 0) + (outputTokens ?? 0) : null)
  if (inputTokens === null && outputTokens === null && totalTokens === null) return undefined
  return { inputTokens, outputTokens, totalTokens }
}

function searchStatsFromResult(result: unknown): ObservationSearchStats | undefined {
  if (!result || typeof result !== "object") return undefined
  const value = result as Record<string, unknown>
  const stats = value.searchStats
  if (stats && typeof stats === "object") return stats as ObservationSearchStats
  if (!Array.isArray(value.results)) return undefined
  return {
    filesReturned: value.results.length,
    candidateCount: value.results.length,
    sourcesReturned: Array.isArray(value.sources) ? value.sources.length : undefined,
  }
}

function decorateToolResult(
  result: unknown,
  meta: {
    traceId: string
    toolCallId: string
    durationMs: number
    usage?: ObservationUsage
    searchStats?: ObservationSearchStats
  },
): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result) || result instanceof Date) return result
  const value = result as Record<string, unknown>
  return {
    ...value,
    traceId: meta.traceId,
    memory_trace_id: meta.traceId,
    toolCallId: meta.toolCallId,
    durationMs: meta.durationMs,
    ...(meta.usage ? { usage: meta.usage } : {}),
    ...(meta.searchStats ? { searchStats: meta.searchStats } : {}),
  }
}

export function observationAttributesForResult(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") return {}
  const value = result as Record<string, unknown>
  const attributes: Record<string, unknown> = {}

  if (Array.isArray(value.files)) attributes.files_returned = value.files.length
  if (Array.isArray(value.results)) attributes.files_returned = value.results.length
  if (Array.isArray(value.filesIncluded)) attributes.files_included = value.filesIncluded.length
  if (Array.isArray(value.filesOmitted)) attributes.files_omitted = value.filesOmitted.length
  if (Array.isArray(value.sources)) attributes.sources_returned = value.sources.length
  if (Array.isArray(value.writes)) attributes.write_count = value.writes.length
  if (typeof value.changed === "boolean") attributes.changed = value.changed
  if (typeof value.created === "boolean") attributes.created = value.created
  if (typeof value.updated === "boolean") attributes.updated = value.updated
  if (typeof value.truncated === "boolean") attributes.truncated = value.truncated
  if (typeof value.dryRun === "boolean") attributes.dry_run = value.dryRun

  const usage = usageFromResult(result)
  Object.assign(attributes, usageAttributes(usage))
  const searchStats = searchStatsFromResult(result)
  Object.assign(attributes, searchStatsAttributes(searchStats))

  return attributes
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

function usageAttributes(usage: ObservationUsage | undefined): Record<string, unknown> {
  if (!usage) return {}
  return {
    input_tokens: usage.inputTokens ?? null,
    output_tokens: usage.outputTokens ?? null,
    total_tokens: usage.totalTokens ?? null,
  }
}

function searchStatsAttributes(stats: ObservationSearchStats | undefined): Record<string, unknown> {
  if (!stats) return {}
  return {
    search_mode: stats.searchMode ?? null,
    candidate_count: stats.candidateCount ?? null,
    files_returned: stats.filesReturned ?? null,
    files_read: stats.filesRead ?? null,
    sources_returned: stats.sourcesReturned ?? null,
  }
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Math.max(0, Math.trunc(value))
}

function numberFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code
  }
  if (error instanceof Error) return error.name || "ERROR"
  return "ERROR"
}
