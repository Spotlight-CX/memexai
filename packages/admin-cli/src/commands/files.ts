import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import type { AdminClient } from "../client"
import { printJson, printTable, printRaw, printError } from "../output"
import { flag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin files <subcommand> [options]

Subcommands:
  list [--prefix <path>]            List memory files
  get <path>                        Get file content (raw by default; use --json for metadata)
  write <path> [--content <text>]   Write a file (reads stdin if --content omitted)
         [--content-file <file>]
         [--reason <reason>]

Options:
  --prefix <path>       Filter by path prefix (e.g. shared/ or users/alice/)
  --content <text>      File content as a string
  --content-file <f>    Read content from a file
  --reason <r>          Reason for write (stored in revision history)
  --json                Output raw JSON
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

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin files --help'`)
  process.exit(1)
}
