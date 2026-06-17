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
  2. Agent writes the three cognitive-architecture files to shared/:
       memex-admin files write shared/procedural.md --content "..." --reason "bootstrap"
       memex-admin files write shared/semantic.md   --content "..." --reason "bootstrap"
       memex-admin files write shared/episodic.md   --content "..." --reason "bootstrap"
  3. Optionally, write a domain-specific example file:
       memex-admin files write shared/domain.md --content "..." --reason "bootstrap"
  4. Agent marks setup complete:
       memex-admin setup complete --note "real-estate assistant"
  5. Agent writes MEMEX.md to the project repo (CLI does NOT generate this)

Cognitive architecture (two-level):
  shared/procedural.md  →  rules: how the agent must behave
  shared/semantic.md    →  schema: what facts to store in user/profile.md
  shared/episodic.md    →  schema: what events to append to user/log.md
  user/profile.md       →  semantic instances: stable facts per user
  user/log.md           →  episodic log: time-ordered events per user (append-only)

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

    // Derive a single concrete next command
    const has = (name: string) => result.sharedFiles.some((p) => p.includes(name))
    if (!result.bootstrapped) {
      const S = "-s $MEMEX_SERVICE_URL --admin-secret $MEMEX_ADMIN_SECRET"
      let nextCmd: string
      if (!has("procedural")) {
        nextCmd = `memex-admin ${S} files write shared/procedural.md --content "..." --reason bootstrap`
      } else if (!has("semantic")) {
        nextCmd = `memex-admin ${S} files write shared/semantic.md --content "..." --reason bootstrap`
      } else if (!has("episodic")) {
        nextCmd = `memex-admin ${S} files write shared/episodic.md --content "..." --reason bootstrap`
      } else {
        nextCmd = `memex-admin ${S} setup complete --note "describe your agent"`
      }
      process.stdout.write(`\n→ Next:\n  ${nextCmd}\n`)
      process.stdout.write(`  (or run: npx @memexai/admin init --yes to automate all steps)\n`)
    } else {
      const S = "-s $MEMEX_SERVICE_URL --admin-secret $MEMEX_ADMIN_SECRET"
      process.stdout.write(`\n→ Inspect:\n`)
      process.stdout.write(`  memex-admin ${S} files list --prefix shared/\n`)
      process.stdout.write(`  memex-admin ${S} files list --prefix users/USERID/\n`)
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
    process.stdout.write(`✓ Setup complete at ${result.setupCompletedAt}\n`)
    if (result.note) process.stdout.write(`Note: ${result.note}\n`)
    process.stdout.write(`\nShared files:\n`)
    printTable(result.sharedFiles.map((p) => ({ path: p })), ["path"])

    const S = "-s $MEMEX_SERVICE_URL --admin-secret $MEMEX_ADMIN_SECRET"
    process.stdout.write(`
→ What to do next:

  Inspect shared files:
    memex-admin ${S} files list --prefix shared/
    memex-admin ${S} files get shared/procedural.md

  After your agent runs a session (replace USERID and TOOL_CALL_ID):
    memex-admin ${S} files list --prefix users/USERID/
    memex-admin ${S} files get users/USERID/preferences.md
    memex-admin ${S} logs list --user USERID --limit 20
    memex-admin ${S} trace TOOL_CALL_ID

  Sync shared memory in CI/CD:
    memex-admin ${S} shared push --from ./.memexai/shared/
`)
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin setup --help'`)
  process.exit(1)
}
