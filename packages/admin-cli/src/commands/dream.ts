import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, boolFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin dream <subcommand> [options]

Manage the dreaming system — background memory compaction and consolidation.

Subcommands:
  status [--user <id>]           Show dream cycle status per user
  run [--user <id>]              Trigger a dream run (HTTP service mode only)
  pause <userId>                 Pause dream cycle for a user
  unpause <userId>               Resume dream cycle for a user
  config [get]                   Show all dream configuration
  config set --key <k> --value <v>  Update a single config value

Config keys:
  dream_enabled                  Enable/disable dreaming (true/false)
  dream_interval_minutes         How often dreaming runs per user
  dream_grace_period_minutes     Silence required before dreaming starts
  dream_max_writes               Max file writes per dream cycle
  dream_concurrency              Max users dreaming simultaneously

Options:
  --user, -u <id>        Filter to a specific user
  --json                 Output raw JSON

Examples:
  memex-admin dream status                                     # all users
  memex-admin dream status --user alice                        # one user
  memex-admin dream run --user alice                           # trigger now (HTTP only)
  memex-admin dream pause alice                                # stop dreaming for user
  memex-admin dream unpause alice                              # resume dreaming
  memex-admin dream config get                                 # view all settings
  memex-admin dream config set --key dream_interval_minutes --value 60
  memex-admin dream config set --key dream_enabled --value false
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

  if (sub === "config") {
    const action = args.positional[0] ?? "get"

    if (action === "get" || action === undefined) {
      const result = await client.getDreamConfig() as {
        rows: Array<{ key: string; value: string; description: string | null; updatedAt: unknown }>
      }
      if (jsonMode) { printJson(result); return }
      printTable(result.rows ?? [], ["key", "value", "description", "updatedAt"])
      return
    }

    if (action === "set") {
      const key = flag(args.flags, "key", "k")
      const value = flag(args.flags, "value", "v")
      if (!key) { printError("--key is required", "MISSING_ARG"); process.exit(2) }
      if (value === undefined) { printError("--value is required", "MISSING_ARG"); process.exit(2) }
      if (!key.startsWith("dream_")) { printError(`Config key must start with 'dream_'`, "INVALID_KEY"); process.exit(2) }
      const result = await client.setDreamConfig({ [key]: value })
      if (jsonMode) { printJson(result); return }
      process.stdout.write(`Updated ${key} = ${value}\n`)
      return
    }

    printError(`Unknown config action: ${action}. Use 'get' or 'set'.`)
    process.exit(1)
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin dream --help'`)
  process.exit(1)
}
