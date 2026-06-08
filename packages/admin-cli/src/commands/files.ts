import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import type { AdminClient } from "../client"
import { printJson, printTable, printRaw, printError } from "../output"
import { flag, boolFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin files <subcommand> [options]

Read and write memory files in Postgres. Paths are physical (e.g. users/alice/profile.md).

Subcommands:
  list [--prefix <path>]              List memory files
  get <path>                          Get file content (raw by default)
  write <path>                        Write or overwrite a file
  rollback <path>                     Restore a file to a previous revision
  delete <path>                       Delete a file permanently

Options:
  --prefix <path>         Filter by path prefix (e.g. shared/ or users/alice/)
  --content <text>        File content as a string
  --content-file <f>      Read content from a file
  --reason <r>            Reason for write (stored in revision history)
  --offset <n>            Rollback: restore the Nth-previous version (1 = one before latest)
  --to <revisionId>       Rollback: restore to a specific revision ID (from revisions list)
  --yes                   Skip confirmation prompt for destructive operations
  --json                  Output raw JSON

Examples:
  memex-admin files list                                     # list all files
  memex-admin files list --prefix users/alice/               # files for one user
  memex-admin files get users/alice/profile.md               # print content
  memex-admin files write users/alice/profile.md --content "Name: Alice" --reason "seed"
  memex-admin files rollback users/alice/profile.md --offset 1   # restore one version back
  memex-admin files rollback users/alice/profile.md --to abc123  # restore to specific revision
  memex-admin files delete users/alice/scratch.md --yes          # delete, no prompt
`

export async function filesCommand(
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
    const prefix = flag(args.flags, "prefix")
    const result = await client.listFiles({ prefix }) as { files: unknown[] }
    if (jsonMode) { printJson(result); return }
    const rows = (result.files ?? []) as Record<string, unknown>[]
    printTable(rows, ["physicalPath", "size", "updatedAt"])
    return
  }

  if (sub === "get") {
    const path = args.positional[0]
    if (!path) { printError("path is required", "MISSING_ARG"); process.exit(2) }
    const result = await client.getFile(path) as { file: { content: string; [k: string]: unknown } }
    if (jsonMode) { printJson(result); return }
    printRaw(result.file.content)
    return
  }

  if (sub === "write") {
    const path = args.positional[0]
    if (!path) { printError("path is required", "MISSING_ARG"); process.exit(2) }

    let content: string
    const contentFlag = flag(args.flags, "content")
    const contentFile = flag(args.flags, "content-file")

    if (contentFlag !== undefined) {
      content = contentFlag
    } else if (contentFile) {
      try {
        content = await readFile(contentFile, "utf8")
      } catch {
        printError(`Cannot read file: ${contentFile}`)
        process.exit(1)
      }
    } else if (!process.stdin.isTTY) {
      content = readFileSync("/dev/stdin", "utf8")
    } else {
      printError("Provide --content <text>, --content-file <path>, or pipe content via stdin")
      process.exit(2)
    }

    const reason = flag(args.flags, "reason")
    const result = await client.writeFile(path, content, reason)
    if (jsonMode) { printJson(result); return }
    const r = result as { physicalPath: string; created: boolean; updated: boolean }
    process.stdout.write(`${r.created ? "Created" : "Updated"} ${r.physicalPath}\n`)
    return
  }

  if (sub === "rollback") {
    const path = args.positional[0]
    if (!path) { printError("path is required", "MISSING_ARG"); process.exit(2) }
    const yes = boolFlag(args.flags, "yes", "y")
    const reason = flag(args.flags, "reason") ?? "rollback by admin"
    const toRevId = flag(args.flags, "to")

    let revisionContent: string
    let revisionMeta: { createdAt: unknown; actor: unknown; id?: string }

    if (toRevId) {
      // Restore to specific revision ID via diff endpoint
      const diffResult = await client.getRevisionDiff({ path, revA: toRevId, revB: toRevId }) as {
        revA: { id: string; actor: string | null; reason: string | null; createdAt: unknown; content: string }
      }
      revisionContent = diffResult.revA.content
      revisionMeta = { id: toRevId, createdAt: diffResult.revA.createdAt, actor: diffResult.revA.actor }
    } else {
      // Default: restore to offset 1 (one before latest)
      const offsetVal = parseInt(flag(args.flags, "offset") ?? "1", 10) || 1
      if (client.mode === "direct") {
        const rev = await client.getRevisionAtOffset(path, offsetVal) as {
          id: string; content: string; createdAt: unknown; actor: string | null
        }
        revisionContent = rev.content
        revisionMeta = { id: rev.id, createdAt: rev.createdAt, actor: rev.actor }
      } else {
        // HTTP mode: use diff to get older revision content
        const diffResult = await client.getRevisionDiff({ path }) as {
          revA: { id: string; actor: string | null; createdAt: unknown; content: string }
          revB: { id: string; actor: string | null; createdAt: unknown; content: string }
        }
        // revA is older, revB is newer — rollback to revA
        revisionContent = diffResult.revA.content
        revisionMeta = { id: diffResult.revA.id, createdAt: diffResult.revA.createdAt, actor: diffResult.revA.actor }
      }
    }

    if (!yes) {
      process.stdout.write(`\nRestore ${path}\n`)
      process.stdout.write(`  to revision: ${revisionMeta.id ?? "(unknown)"}\n`)
      process.stdout.write(`  created:     ${revisionMeta.createdAt}\n`)
      process.stdout.write(`  actor:       ${revisionMeta.actor ?? "unknown"}\n`)
      process.stdout.write(`\nCurrent content will be saved as a new revision before overwriting.\n`)
      process.stdout.write(`Pass --yes to confirm.\n\n`)
      process.exit(1)
    }

    const result = await client.writeFile(path, revisionContent, reason)
    if (jsonMode) { printJson(result); return }
    const r = result as { physicalPath: string }
    process.stdout.write(`Restored ${r.physicalPath} — new revision written\n`)
    return
  }

  if (sub === "delete") {
    const path = args.positional[0]
    if (!path) { printError("path is required", "MISSING_ARG"); process.exit(2) }
    const yes = boolFlag(args.flags, "yes", "y")

    if (!yes) {
      process.stdout.write(`\nWill permanently delete file: ${path}\n`)
      process.stdout.write(`Revisions and access logs for this file will remain.\n`)
      process.stdout.write(`Pass --yes to confirm.\n\n`)
      process.exit(1)
    }

    const result = await client.deleteFile(path) as { physicalPath: string; deleted: boolean }
    if (jsonMode) { printJson(result); return }
    process.stdout.write(`Deleted ${result.physicalPath}\n`)
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin files --help'`)
  process.exit(1)
}
