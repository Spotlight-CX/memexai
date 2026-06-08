import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin observe <subcommand> [options]

Aggregate observability metrics for the memory system.
Requires HTTP service mode (--service-url).

Subcommands:
  summary               Overall usage — tool call counts, error rates, latency
  user <userId>         Breakdown for a single user — files, reads, writes
  top-files [--limit]   Most-accessed files ranked by read/write frequency

Options:
  --from <iso>          Start timestamp
  --to <iso>            End timestamp
  --user, -u <id>       Filter by userId
  --limit <n>           Max results (default 20)
  --json                Output raw JSON

Examples:
  memex-admin observe summary                        # overall health
  memex-admin observe user alice                     # alice's memory activity
  memex-admin observe top-files --limit 10           # most-read files
  memex-admin observe summary --from 2024-01-15T00:00:00Z
`

export async function observeCommand(
  sub: string | undefined,
  args: ParsedArgs,
  client: AdminClient,
  jsonMode: boolean,
): Promise<void> {
  if (!sub || sub === "--help" || sub === "-h") {
    process.stdout.write(HELP)
    return
  }

  if (client.mode !== "http") {
    printError("observe commands require HTTP service mode (--service-url)")
    process.exit(1)
  }

  const params = new URLSearchParams()
  const addParam = (k: string, v: string | undefined) => { if (v) params.set(k, v) }
  addParam("from", flag(args.flags, "from"))
  addParam("to", flag(args.flags, "to"))
  addParam("userId", flag(args.flags, "user", "u"))
  const limit = intFlag(args.flags, "limit") ?? 20
  params.set("limit", String(limit))

  if (sub === "summary") {
    const result = await client.rawRequest("GET", `/v1/admin/observability/summary?${params}`)
    if (jsonMode) { printJson(result); return }
    const r = result as Record<string, unknown>
    const totals = (r["totals"] ?? {}) as Record<string, unknown>
    const latency = (r["latency"] ?? {}) as Record<string, unknown>
    process.stdout.write("\nObservability Summary\n\n")
    printTable([totals], Object.keys(totals))
    process.stdout.write("\nLatency\n\n")
    printTable([latency], Object.keys(latency))
    return
  }

  if (sub === "user") {
    const userId = args.positional[0] ?? flag(args.flags, "user", "u")
    if (!userId) { printError("userId is required", "MISSING_ARG"); process.exit(2) }
    params.set("userId", userId)
    const result = await client.rawRequest("GET", `/v1/admin/observability/user?${params}`)
    if (jsonMode) { printJson(result); return }
    process.stdout.write(JSON.stringify(result, null, 2) + "\n")
    return
  }

  if (sub === "top-files") {
    const result = await client.rawRequest("GET", `/v1/admin/observability/top-files?${params}`) as { files: unknown[] }
    if (jsonMode) { printJson(result); return }
    const rows = (result.files ?? []) as Record<string, unknown>[]
    printTable(rows, ["physicalPath", "reads", "writes", "searches", "totalHits", "uniqueUsers"])
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin observe --help'`)
  process.exit(1)
}
