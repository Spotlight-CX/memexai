import type { AdminClient } from "../client"
import { printJson, printTable, printRaw, printError } from "../output"
import { flag, intFlag, boolFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin revisions <subcommand> [options]

Inspect and manage the write history for every memory file.

Subcommands:
  list                   List revisions (filterable by path, user, actor, date)
  diff <path>            Show unified diff between two revisions
  rollback <path>        Restore a file to a previous revision (creates new revision)
  prune                  Delete old revisions by age and/or user

Options (list):
  --path <p>             Filter by exact physical path
  --user <u>             Filter by userId
  --actor <a>            Filter by actor (e.g. dream-agent, admin)
  --from <iso>           Start timestamp (ISO 8601)
  --to <iso>             End timestamp (ISO 8601)
  --limit <n>            Max results (default 50)
  --offset <n>           Pagination offset
  --json                 Output raw JSON

Options (diff):
  --rev-a <id>           Older revision ID (from revisions list)
  --rev-b <id>           Newer revision ID
  (no flags = diff latest vs previous)

Options (rollback):
  --offset <n>           Restore the Nth-previous version (default 1 = one before latest)
  --to <revisionId>      Restore to a specific revision ID
  --reason <r>           Reason stored in revision history
  --yes                  Skip confirmation prompt

Options (prune):
  --older-than <days>    Delete revisions older than N days (required)
  --user <id>            Limit deletion to one user's files
  --keep-latest <n>      Keep at least N revisions per file even if old (default 1)
  --dry-run              Print count of revisions that would be deleted, no deletion

Examples:
  memex-admin revisions list                              # full audit trail
  memex-admin revisions list --path users/alice/profile.md   # one file's history
  memex-admin revisions list --user alice --limit 20
  memex-admin revisions diff users/alice/profile.md           # latest vs previous
  memex-admin revisions diff users/alice/profile.md --rev-a abc123 --rev-b def456
  memex-admin revisions rollback users/alice/profile.md --offset 1 --yes
  memex-admin revisions prune --older-than 30                 # global cleanup
  memex-admin revisions prune --older-than 7 --user alice     # per-user GDPR prune
  memex-admin revisions prune --older-than 30 --dry-run       # preview only
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
    })), ["createdAt", "id", "operation", "actor", "physicalPath", "content"])
    return
  }

  if (sub === "diff") {
    const path = args.positional[0]
    if (!path) { printError("path is required", "MISSING_ARG"); process.exit(2) }
    const revAId = flag(args.flags, "rev-a")
    const revBId = flag(args.flags, "rev-b")
    const color = boolFlag(args.flags, "color")

    const result = await client.getRevisionDiff({ path, revA: revAId, revB: revBId }) as {
      path: string
      revA: { id: string; actor: string | null; reason: string | null; createdAt: unknown; content: string }
      revB: { id: string; actor: string | null; reason: string | null; createdAt: unknown; content: string }
    }

    if (jsonMode) { printJson(result); return }

    const a = result.revA
    const b = result.revB

    process.stdout.write(`--- ${a.id}  ${a.createdAt}  actor: ${a.actor ?? "unknown"}\n`)
    process.stdout.write(`+++ ${b.id}  ${b.createdAt}  actor: ${b.actor ?? "unknown"}\n`)
    process.stdout.write("@@ diff @@\n")

    const diff = colorDiff(a.content, b.content, color || process.stdout.isTTY)
    printRaw(diff || "(no changes between these revisions)")
    return
  }

  if (sub === "rollback") {
    const path = args.positional[0]
    if (!path) { printError("path is required", "MISSING_ARG"); process.exit(2) }
    const yes = boolFlag(args.flags, "yes", "y")
    const reason = flag(args.flags, "reason") ?? "rollback by admin"
    const toRevId = flag(args.flags, "to")
    const offsetVal = intFlag(args.flags, "offset") ?? 1

    let content: string
    let revMeta: { id?: string; createdAt: unknown; actor: unknown }

    if (toRevId) {
      const diffResult = await client.getRevisionDiff({ path, revA: toRevId, revB: toRevId }) as {
        revA: { id: string; actor: string | null; createdAt: unknown; content: string }
      }
      content = diffResult.revA.content
      revMeta = { id: toRevId, createdAt: diffResult.revA.createdAt, actor: diffResult.revA.actor }
    } else if (client.mode === "direct") {
      const rev = await client.getRevisionAtOffset(path, offsetVal) as {
        id: string; content: string; createdAt: unknown; actor: string | null
      }
      content = rev.content
      revMeta = { id: rev.id, createdAt: rev.createdAt, actor: rev.actor }
    } else {
      const diffResult = await client.getRevisionDiff({ path }) as {
        revA: { id: string; actor: string | null; createdAt: unknown; content: string }
      }
      content = diffResult.revA.content
      revMeta = { id: diffResult.revA.id, createdAt: diffResult.revA.createdAt, actor: diffResult.revA.actor }
    }

    if (!yes) {
      process.stdout.write(`\nRestore ${path} to revision ${revMeta.id ?? "?"} (${revMeta.createdAt}, actor: ${revMeta.actor ?? "?"})\n`)
      process.stdout.write(`Current content saved as new revision. Pass --yes to confirm.\n\n`)
      process.exit(1)
    }

    const result = await client.writeFile(path, content, reason)
    if (jsonMode) { printJson(result); return }
    process.stdout.write(`Restored ${path} — new revision written\n`)
    return
  }

  if (sub === "prune") {
    const olderThan = intFlag(args.flags, "older-than")
    if (!olderThan) { printError("--older-than <days> is required", "MISSING_ARG"); process.exit(2) }
    const userId = flag(args.flags, "user", "u")
    const keepLatest = intFlag(args.flags, "keep-latest") ?? 1
    const dryRun = boolFlag(args.flags, "dry-run")

    if (dryRun) {
      process.stdout.write(`Would prune revisions older than ${olderThan} days`)
      if (userId) process.stdout.write(` for user: ${userId}`)
      process.stdout.write(`, keeping at least ${keepLatest} per file.\n`)
      process.stdout.write(`(dry-run: no changes made)\n`)
      return
    }

    const result = await client.pruneRevisions({ olderThanDays: olderThan, userId, keepLatest }) as { deleted: number }
    if (jsonMode) { printJson(result); return }
    process.stdout.write(`Pruned ${result.deleted} revision(s)\n`)
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin revisions --help'`)
  process.exit(1)
}

function colorDiff(oldText: string, newText: string, useColor: boolean): string {
  const RED = useColor ? "\x1b[31m" : ""
  const GREEN = useColor ? "\x1b[32m" : ""
  const RESET = useColor ? "\x1b[0m" : ""

  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const out: string[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i]
    const n = newLines[i]
    if (o === n) { out.push(` ${o ?? ""}`) }
    else {
      if (o !== undefined) out.push(`${RED}-${o}${RESET}`)
      if (n !== undefined) out.push(`${GREEN}+${n}${RESET}`)
    }
  }
  return out.join("\n")
}
