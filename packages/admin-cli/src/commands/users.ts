import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin users <subcommand> [options]

Subcommands:
  list                List all users
  show <userId>       Show details for a specific user

Options:
  --search, -s <q>    Filter users by ID substring
  --limit <n>         Max results (default 50)
  --json              Output raw JSON
`

export async function usersCommand(
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
    const q = flag(args.flags, "search", "s")
    const limit = intFlag(args.flags, "limit") ?? 50
    const result = await client.listUsers({ q, limit }) as { users: unknown[] }
    if (jsonMode) { printJson(result); return }
    const rows = (result.users ?? []) as Record<string, unknown>[]
    printTable(rows, ["userId", "fileCount", "lastWriteAt", "lastReadAt"])
    return
  }

  if (sub === "show") {
    const userId = args.positional[0]
    if (!userId) { printError("userId is required", "MISSING_ARG"); process.exit(2) }
    // Fetch files for this user as a proxy for "show"
    const result = await client.listFiles({ prefix: `users/${userId}/` }) as { files: unknown[] }
    if (jsonMode) { printJson({ userId, ...result }); return }
    const rows = (result.files ?? []) as Record<string, unknown>[]
    process.stdout.write(`User: ${userId}\n\n`)
    printTable(rows, ["physicalPath", "size", "updatedAt"])
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin users --help'`)
  process.exit(1)
}
