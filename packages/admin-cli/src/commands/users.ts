import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, boolFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin users <subcommand> [options]

Manage all identities (human users, agents, tenants) that have stored memory.

Subcommands:
  list                   List all identities with file counts and timestamps
  show <userId>          List files for a specific identity
  delete <userId>        Permanently erase all memory for an identity (GDPR)

Options:
  --search, -s <q>       Filter users by ID substring
  --limit <n>            Max results (default 50)
  --yes                  Skip confirmation prompt
  --json                 Output raw JSON

Examples:
  memex-admin users list                        # all identities (human + agent)
  memex-admin users list --search acme          # filter by ID substring
  memex-admin users show agent_research_bot     # files for a specific identity
  memex-admin users delete alice --yes          # GDPR erasure, no prompt
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
    const result = await client.listFiles({ prefix: `users/${userId}/` }) as { files: unknown[] }
    if (jsonMode) { printJson({ userId, ...result }); return }
    const rows = (result.files ?? []) as Record<string, unknown>[]
    process.stdout.write(`User: ${userId}\n\n`)
    printTable(rows, ["physicalPath", "size", "updatedAt"])
    return
  }

  if (sub === "delete") {
    const userId = args.positional[0]
    if (!userId) { printError("userId is required", "MISSING_ARG"); process.exit(2) }
    const yes = boolFlag(args.flags, "yes", "y")

    if (!yes) {
      // Preflight: show what will be deleted
      const filesResult = await client.listFiles({ prefix: `users/${userId}/` }) as { files: unknown[] }
      const fileCount = (filesResult.files ?? []).length
      process.stdout.write(`\nWill permanently delete all memory for identity: ${userId}\n`)
      process.stdout.write(`  ~${fileCount} memory file(s) found (plus all revisions and access logs)\n`)
      process.stdout.write(`\nThis cannot be undone. Pass --yes to confirm.\n\n`)
      process.exit(1)
    }

    const result = await client.deleteUser(userId) as {
      userId: string
      filesDeleted: number
      revisionsDeleted: number
      logsDeleted: number
      dreamRunDeleted: number
    }
    if (jsonMode) { printJson(result); return }
    process.stdout.write(
      `Deleted ${result.filesDeleted} file(s), ${result.revisionsDeleted} revision(s), ` +
      `${result.logsDeleted} log(s), ${result.dreamRunDeleted} dream run(s) for ${result.userId}\n`,
    )
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin users --help'`)
  process.exit(1)
}
