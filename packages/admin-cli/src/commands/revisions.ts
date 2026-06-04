import type { AdminClient } from "../client"
import { printJson, printTable, printRaw, printError } from "../output"
import { flag, intFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin revisions <subcommand> [options]

Subcommands:
  list                List revisions (filterable)
  diff <path>         Show unified diff between two revisions of a file

Options (list):
  --path <p>          Filter by exact physical path
  --user <u>          Filter by userId
  --actor <a>         Filter by actor
  --from <iso>        Start timestamp (ISO 8601)
  --to <iso>          End timestamp (ISO 8601)
  --limit <n>         Max results (default 50)
  --offset <n>        Pagination offset
  --json              Output raw JSON

Options (diff):
  --rev-a <n>         Older revision offset (0 = latest, 1 = one before, …)
  --rev-b <n>         Newer revision offset
`

export async function revisionsCommand(
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
    const result = await client.listRevisions({
      physicalPath: flag(args.flags, "path"),
      userId: flag(args.flags, "user", "u"),
      actor: flag(args.flags, "actor"),
      from: flag(args.flags, "from"),
      to: flag(args.flags, "to"),
      limit: intFlag(args.flags, "limit") ?? 50,
      offset: intFlag(args.flags, "offset") ?? 0,
    }) as { revisions: unknown[]; pagination: unknown }
    if (jsonMode) { printJson(result); return }
    const rows = (result.revisions ?? []) as Record<string, unknown>[]
    printTable(rows.map((r) => ({
      ...r,
      content: typeof r["content"] === "string" ? r["content"].slice(0, 40).replace(/\n/g, "↵") : "",
    })), ["createdAt", "operation", "actor", "physicalPath", "content"])
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
    if (jsonMode) { printJson({ path, revA: { offset: revA, ...a }, revB: { offset: revB, ...b } }); return }
    process.stdout.write(`--- revision offset ${revA}  (${a.createdAt})  actor: ${a.actor ?? "unknown"}\n`)
    process.stdout.write(`+++ revision offset ${revB}  (${b.createdAt})  actor: ${b.actor ?? "unknown"}\n`)
    const diff = simpleDiff(a.content, b.content)
    printRaw(diff || "(no changes between these revisions)")
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin revisions --help'`)
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
  return out.join("\n")
}
