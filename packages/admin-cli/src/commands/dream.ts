import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin dream <subcommand> [options]

Subcommands:
  status [--user <id>]      Show dream cycle status
  run [--user <id>]         Trigger a dream run (HTTP service mode only)
  pause <userId>            Pause dream cycle for a user
  unpause <userId>          Resume dream cycle for a user

Options:
  --user, -u <id>   Filter to a specific user
  --json            Output raw JSON
`

export async function dreamCommand(
  sub: string | undefined,
  args: ParsedArgs,
  client: AdminClient,
  jsonMode: boolean,
): Promise<void> {
  if (!sub || sub === "--help" || sub === "-h") {
    process.stdout.write(HELP)
    return
  }

  if (sub === "status") {
    const userId = flag(args.flags, "user", "u")
    const limit = intFlag(args.flags, "limit") ?? 50
    const result = await client.listDreamUsers({ q: userId, limit }) as {
      users: unknown[]
      summary: unknown
      pagination: unknown
    }
    if (jsonMode) { printJson(result); return }
    const rows = (result.users ?? []) as Record<string, unknown>[]
    printTable(rows, ["userId", "status", "paused", "dreamCount", "lastStartedAt", "lastDreamedAt", "filesTouched", "error"])
    return
  }

  if (sub === "run") {
    if (client.mode !== "http") {
      printError("dream run requires HTTP service mode (--service-url). Use the service admin UI or API directly for direct-mode dream triggers.")
      process.exit(1)
    }
    const userId = flag(args.flags, "user", "u")
    const result = await client.rawRequest("POST", "/v1/admin/dream/run", userId ? { userId } : {})
    if (jsonMode) { printJson(result); return }
    process.stdout.write(`Dream run triggered${userId ? ` for ${userId}` : ""}\n`)
    return
  }

  if (sub === "pause" || sub === "unpause") {
    const userId = args.positional[0] ?? flag(args.flags, "user", "u")
    if (!userId) { printError("userId is required", "MISSING_ARG"); process.exit(2) }
    if (client.mode !== "http") {
      printError(`dream ${sub} requires HTTP service mode (--service-url)`)
      process.exit(1)
    }
    const paused = sub === "pause"
    const result = await client.rawRequest("PUT", `/v1/admin/dream/users/${encodeURIComponent(userId)}/paused`, { paused })
    if (jsonMode) { printJson(result); return }
    process.stdout.write(`${userId} dream cycle ${paused ? "paused" : "unpaused"}\n`)
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin dream --help'`)
  process.exit(1)
}
