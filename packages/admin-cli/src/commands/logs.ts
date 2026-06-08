import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin logs list [options]

Every memory read and write is logged here. Use tool-call-id to correlate
a specific agent action with the revisions it produced.

Options:
  --path <p>           Filter by exact physical path
  --user, -u <id>      Filter by userId
  --tool-call-id <id>  Filter by toolCallId (links to revisions)
  --from <iso>         Start timestamp (ISO 8601)
  --to <iso>           End timestamp (ISO 8601)
  --limit <n>          Max results (default 50)
  --offset <n>         Pagination offset
  --json               Output raw JSON

Examples:
  memex-admin logs list                                 # all recent activity
  memex-admin logs list --user alice                    # all activity for alice
  memex-admin logs list --path users/alice/profile.md   # reads/writes for one file
  memex-admin logs list --tool-call-id abc123           # trace one agent action
  memex-admin logs list --from 2024-01-15T00:00:00Z --limit 100
`

export async function logsCommand(
  sub: string | undefined,
  args: ParsedArgs,
  client: AdminClient,
  jsonMode: boolean,
): Promise<void> {
  if (!sub || sub === "--help" || sub === "-h") {
    process.stdout.write(HELP)
    return
  }

  if (sub === "list") {
    const result = await client.listAccessLogs({
      physicalPath: flag(args.flags, "path"),
      userId: flag(args.flags, "user", "u"),
      toolCallId: flag(args.flags, "tool-call-id"),
      from: flag(args.flags, "from"),
      to: flag(args.flags, "to"),
      limit: intFlag(args.flags, "limit") ?? 50,
      offset: intFlag(args.flags, "offset") ?? 0,
    }) as { accessLogs: unknown[]; pagination: unknown }
    if (jsonMode) { printJson(result); return }
    const rows = (result.accessLogs ?? []) as Record<string, unknown>[]
    printTable(rows, ["createdAt", "operation", "actor", "userId", "physicalPath", "toolCallId"])
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin logs --help'`)
  process.exit(1)
}
