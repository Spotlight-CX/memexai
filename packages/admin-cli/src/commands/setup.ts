import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin setup <subcommand> [options]

Subcommands:
  status              Check if shared memory is bootstrapped
  complete [--note]   Mark setup as done, persist a note in mx_config

The agent-driven bootstrap flow:
  1. Agent reads codebase, decides memory shape
  2. Agent writes shared files:
       memex-admin files write shared/index.md --content "..." --reason "bootstrap"
  3. Agent marks setup complete:
       memex-admin setup complete --note "real-estate assistant"
  4. Agent writes MEMEX.md to the project repo (CLI does NOT generate this)

Options:
  --note <text>   Optional note stored with the completion record
  --json          Output raw JSON
`

export async function setupCommand(
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
    const result = await client.getSetupStatus() as {
      bootstrapped: boolean
      sharedFiles: string[]
      setupCompletedAt: string | null
      setupNote: string | null
      nextSteps: string[]
    }
    if (jsonMode) { printJson(result); return }
    process.stdout.write(`\nSetup status: ${result.bootstrapped ? "✓ bootstrapped" : "✗ not complete"}\n`)
    if (result.setupNote) process.stdout.write(`Note:         ${result.setupNote}\n`)
    if (result.setupCompletedAt) process.stdout.write(`Completed at: ${result.setupCompletedAt}\n`)
    process.stdout.write(`\nShared files (${result.sharedFiles.length}):\n`)
    printTable(result.sharedFiles.map((p) => ({ path: p })), ["path"])
    if (result.nextSteps.length > 0) {
      process.stdout.write("\nNext steps:\n")
      for (const step of result.nextSteps) process.stdout.write(`  • ${step}\n`)
    }
    return
  }

  if (sub === "complete") {
    const note = flag(args.flags, "note")
    const result = await client.writeSetupComplete(note) as {
      setupCompletedAt: string
      note: string | null
      sharedFiles: string[]
    }
    if (jsonMode) { printJson(result); return }
    process.stdout.write(`Setup marked complete at ${result.setupCompletedAt}\n`)
    if (result.note) process.stdout.write(`Note: ${result.note}\n`)
    process.stdout.write(`\nShared files written:\n`)
    printTable(result.sharedFiles.map((p) => ({ path: p })), ["path"])
    process.stdout.write(`\nNext: write MEMEX.md to your project repo documenting the memory shape\n`)
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin setup --help'`)
  process.exit(1)
}
