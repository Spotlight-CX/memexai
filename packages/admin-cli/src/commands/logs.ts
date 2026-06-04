import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin logs list [options]

Options:
  --path <p>           Filter by exact physical path
  --user, -u <id>      Filter by userId
  --tool-call-id <id>  Filter by toolCallId
  --from <iso>         Start timestamp (ISO 8601)
  --to <iso>           End timestamp (ISO 8601)
  --limit <n>          Max results (default 50)
  --offset <n>         Pagination offset
  --json               Output raw JSON
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
