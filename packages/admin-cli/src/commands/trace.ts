import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin trace <toolCallId>           Trace a single tool call
       memex-admin trace session --user <id>    List all tool calls for a user

Trace shows: observation event + files accessed + revisions written.

Options (single trace):
  <toolCallId>            The tool_call_id to trace (positional)
  --json                  Output raw JSON

Options (session):
  --user, -u <id>         User ID (required)
  --from <iso>            Start timestamp
  --limit <n>             Max events (default 50)
  --json                  Output raw JSON
`

export async function traceCommand(
  sub: string | undefined,
  args: ParsedArgs,
  client: AdminClient,
  jsonMode: boolean,
): Promise<void> {
  if (!sub || sub === "--help" || sub === "-h") {
    process.stdout.write(HELP)
    return
  }

  if (sub === "session") {
    const userId = flag(args.flags, "user", "u")
    if (!userId) { printError("--user is required for trace session", "MISSING_ARG"); process.exit(2) }
    const result = await client.listTraceSession({
      userId,
      from: flag(args.flags, "from"),
      limit: intFlag(args.flags, "limit") ?? 50,
    }) as { userId: string; events: unknown[] }
    if (jsonMode) { printJson(result); return }
    const rows = (result.events ?? []) as Record<string, unknown>[]
    process.stdout.write(`Session trace for user: ${result.userId}\n\n`)
    printTable(rows, ["createdAt", "toolName", "status", "durationMs", "operation", "physicalPath", "toolCallId"])
    return
  }

  // Single trace by toolCallId
  const toolCallId = sub
  const result = await client.getAgenticTrace(toolCallId) as {
    toolCallId: string
    event: Record<string, unknown> | null
    spans?: unknown[]
    accessLog: unknown[]
    revisions: unknown[]
  }
  if (jsonMode) { printJson(result); return }

  const e = result.event
  if (e) {
    process.stdout.write(`\nTrace: ${result.toolCallId}\n`)
    process.stdout.write(`Tool:     ${e["toolName"] ?? "unknown"}  |  Status: ${e["status"]}  |  Duration: ${e["durationMs"] != null ? `${e["durationMs"]}ms` : "?"}\n`)
    process.stdout.write(`User:     ${e["userId"] ?? "?"}  |  Actor: ${e["actor"] ?? "?"}\n`)
    if (e["traceId"]) process.stdout.write(`Trace ID: ${e["traceId"]}\n`)
    if (e["errorCode"]) process.stdout.write(`Error:    ${e["errorCode"]}\n`)
  } else {
    process.stdout.write(`\nTrace: ${result.toolCallId}  (no observation event found)\n`)
  }

  if ((result.spans ?? []).length > 0) {
    process.stdout.write(`\nSpans (${(result.spans ?? []).length}):\n`)
    printTable(result.spans as Record<string, unknown>[], ["createdAt", "toolName", "status", "durationMs", "operation", "physicalPath", "parentSpanId"])
  }

  if ((result.accessLog as unknown[]).length > 0) {
    process.stdout.write(`\nFiles accessed (${(result.accessLog as unknown[]).length}):\n`)
    printTable(result.accessLog as Record<string, unknown>[], ["createdAt", "operation", "physicalPath", "actor"])
  }

  if ((result.revisions as unknown[]).length > 0) {
    process.stdout.write(`\nRevisions written (${(result.revisions as unknown[]).length}):\n`)
    printTable(result.revisions as Record<string, unknown>[], ["createdAt", "operation", "physicalPath", "sizeBytes", "reason"])
  }

  if ((result.accessLog as unknown[]).length === 0 && (result.revisions as unknown[]).length === 0) {
    process.stdout.write(`\n(no file activity found for this tool call)\n`)
  }

  process.stdout.write("\nUse --json for full payloads\n")
}
