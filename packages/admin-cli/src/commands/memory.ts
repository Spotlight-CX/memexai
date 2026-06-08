import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, intFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin memory <subcommand> [options]

Reconstruct memory state at any point in time, or diff two revisions.
Requires direct --database-url mode.

Subcommands:
  snapshot --user <id> [--at <iso>]     Reconstruct memory at a timestamp
  diff <path> [--rev-a N] [--rev-b M]   Show diff between two revisions by offset

snapshot options:
  --user, -u <id>       User ID (required)
  --at <iso>            ISO timestamp to time-travel to (default: current state)
  --json                Output raw JSON (includes full file content)

diff options:
  --rev-a <n>           Older revision offset (0 = latest, 1 = previous, …)
  --rev-b <n>           Newer revision offset (default 0 = latest)
  --json                Output raw JSON

Examples:
  memex-admin memory snapshot --user alice                         # current state
  memex-admin memory snapshot --user alice --at 2024-01-15T09:00:00Z
  memex-admin memory diff users/alice/profile.md                   # latest vs previous
  memex-admin memory diff users/alice/profile.md --rev-a 2 --rev-b 1
  memex-admin memory snapshot --user alice --json | jq '.files[].physicalPath'
`

export async function memoryCommand(
  sub: string | undefined,
  args: ParsedArgs,
  client: AdminClient,
  jsonMode: boolean,
): Promise<void> {
  if (!sub || sub === "--help" || sub === "-h") {
    process.stdout.write(HELP)
    return
  }

  if (sub === "snapshot") {
    const userId = flag(args.flags, "user", "u")
    if (!userId) { printError("--user is required", "MISSING_ARG"); process.exit(2) }
    const at = flag(args.flags, "at")
    const result = await client.getMemorySnapshot(userId, at) as {
      userId: string
      asOf: string | null
      files: Array<{ physicalPath: string; content: string; size: number; writtenAt: string; actor: string | null; reason: string | null; toolCallId: string | null }>
    }
    if (jsonMode) { printJson(result); return }

    const asOfLabel = result.asOf ? `@ ${result.asOf}` : "(current state)"
    process.stdout.write(`\nMemory snapshot for ${result.userId} ${asOfLabel}\n`)
    process.stdout.write(`${result.files.length} file(s)\n\n`)
    printTable(
      result.files.map((f) => ({
        path: f.physicalPath.replace(`users/${userId}/`, "user/"),
        size: f.size,
        writtenAt: f.writtenAt,
        actor: f.actor ?? "",
        reason: f.reason?.slice(0, 40) ?? "",
      })),
      ["writtenAt", "path", "size", "actor", "reason"],
    )
    process.stdout.write("\nUse --json to include full file content\n")
    return
  }

  if (sub === "diff") {
    const path = args.positional[0]
    if (!path) { printError("path is required", "MISSING_ARG"); process.exit(2) }
    const revA = intFlag(args.flags, "rev-a") ?? 1
    const revB = intFlag(args.flags, "rev-b") ?? 0

    const [a, b] = await Promise.all([
      client.getRevisionAtOffset(path, revA) as Promise<{ content: string; createdAt: string; actor: string | null }>,
      client.getRevisionAtOffset(path, revB) as Promise<{ content: string; createdAt: string; actor: string | null }>,
    ])

    if (jsonMode) {
      printJson({ path, a: { offset: revA, ...a }, b: { offset: revB, ...b } })
      return
    }

    process.stdout.write(`--- offset ${revA}  ${a.createdAt}  (${a.actor ?? "unknown"})\n`)
    process.stdout.write(`+++ offset ${revB}  ${b.createdAt}  (${b.actor ?? "unknown"})\n\n`)
    const diff = simpleDiff(a.content, b.content)
    process.stdout.write(diff || "(no changes)\n")
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin memory --help'`)
  process.exit(1)
}

function simpleDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const out: string[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i]
    const n = newLines[i]
    if (o === n) { out.push(` ${o ?? ""}`) }
    else {
      if (o !== undefined) out.push(`-${o}`)
      if (n !== undefined) out.push(`+${n}`)
    }
  }
  return out.join("\n") + "\n"
}
