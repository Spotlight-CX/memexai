import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { createHash } from "node:crypto"
import type { AdminClient } from "../client"
import { printJson, printTable, printError } from "../output"
import { flag, boolFlag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin shared <subcommand> [options]

Sync shared/ memory files between the local .memexai/shared/ directory
and the MemexAI service. Use for version-controlled shared memory and CI/CD deploys.

Subcommands:
  pull [--out <dir>]    Pull shared/ files from service to local filesystem
  push [--from <dir>]   Push local files to service (idempotent, CI/CD safe)

Options:
  --out <dir>     Directory to write pulled files (default: ./.memexai/shared/)
  --from <dir>    Directory to read files to push (default: ./.memexai/shared/)
  --dry-run       Show what would change without writing (push only)
  --json          Output raw JSON

Examples:
  # Pull current shared files from service (review or audit)
  memex-admin -s $MEMEX_SERVICE_URL --admin-secret $SECRET shared pull

  # Push local .memexai/shared/ to service
  memex-admin -s $MEMEX_SERVICE_URL --admin-secret $SECRET shared push

  # Preview what push would change
  memex-admin -s $MEMEX_SERVICE_URL --admin-secret $SECRET shared push --dry-run

CI/CD (GitHub Actions):
  - name: Deploy shared memory
    run: |
      npx @memexai/admin \\
        --service-url \${{ secrets.MEMEX_SERVICE_URL }} \\
        --admin-secret \${{ secrets.MEMEX_ADMIN_SECRET }} \\
        shared push --from ./.memexai/shared/
`

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16)
}

// ─── pull ─────────────────────────────────────────────────────────────────────

async function pullShared(args: ParsedArgs, client: AdminClient, jsonMode: boolean): Promise<void> {
  const outDir = flag(args.flags, "out") ?? "./.memexai/shared"
  const absOutDir = outDir.startsWith("/") ? outDir : join(process.cwd(), outDir)

  const filesRaw = await client.listFiles({ prefix: "shared/" }) as {
    files?: Array<{ physicalPath?: string; contentText?: string; updatedAt?: string; size?: number }>
  }
  const files = filesRaw.files ?? (filesRaw as unknown as Array<{ physicalPath?: string }>)

  if (!Array.isArray(files) || files.length === 0) {
    process.stdout.write("No shared/ files found on service.\n")
    process.stdout.write(`→ Bootstrap with: memex-admin init\n`)
    return
  }

  mkdirSync(absOutDir, { recursive: true })

  const rows: Array<{ file: string; status: string; bytes: string }> = []

  for (const f of files) {
    const path = (f as { physicalPath?: string; physical_path?: string }).physicalPath
      ?? (f as { physical_path?: string }).physical_path ?? ""
    if (!path.startsWith("shared/")) continue

    const fileResult = await client.getFile(path) as { content?: string; contentText?: string }
    const content = fileResult.content ?? fileResult.contentText ?? ""

    const localName = path.replace("shared/", "")
    const localPath = join(absOutDir, localName)

    let status = "pulled"
    if (existsSync(localPath)) {
      const existing = readFileSync(localPath, "utf8")
      if (existing === content) {
        status = "unchanged"
      }
    } else {
      status = "new"
    }

    if (status !== "unchanged") {
      mkdirSync(dirname(localPath), { recursive: true })
      writeFileSync(localPath, content)
    }

    rows.push({ file: path, status, bytes: String(Buffer.byteLength(content)) })
  }

  if (jsonMode) {
    printJson(rows)
    return
  }

  printTable(rows, ["file", "status", "bytes"])
  const changed = rows.filter((r) => r.status !== "unchanged").length
  process.stdout.write(`\n${changed} file(s) updated, ${rows.length - changed} unchanged → ${absOutDir}\n`)
  if (changed > 0) {
    process.stdout.write(`\n→ Commit .memexai/shared/ to version control\n`)
    process.stdout.write(`→ Push changes back with: memex-admin shared push --from ${outDir}\n`)
  }
}

// ─── push ─────────────────────────────────────────────────────────────────────

async function pushShared(args: ParsedArgs, client: AdminClient, jsonMode: boolean): Promise<void> {
  const fromDir = flag(args.flags, "from") ?? "./.memexai/shared"
  const absFromDir = fromDir.startsWith("/") ? fromDir : join(process.cwd(), fromDir)
  const dryRun = boolFlag(args.flags, "dry-run")

  if (!existsSync(absFromDir)) {
    printError(`Directory not found: ${absFromDir}`)
    process.stdout.write(`→ Run first: memex-admin init (creates .memexai/shared/)\n`)
    process.exit(1)
  }

  // Collect local files
  const localFiles: Array<{ localPath: string; servicePath: string; content: string }> = []
  function collect(dir: string) {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry)
      if (statSync(abs).isDirectory()) {
        collect(abs)
      } else {
        const rel = abs.replace(absFromDir + "/", "").replace(absFromDir + "\\", "")
        localFiles.push({
          localPath: abs,
          servicePath: `shared/${rel}`,
          content: readFileSync(abs, "utf8"),
        })
      }
    }
  }
  collect(absFromDir)

  if (localFiles.length === 0) {
    process.stdout.write(`No files found in ${absFromDir}\n`)
    return
  }

  // Compare with service
  const serviceFilesRaw = await client.listFiles({ prefix: "shared/" }) as {
    files?: Array<{ physicalPath?: string; physical_path?: string; contentText?: string }>
  }
  const serviceFiles = serviceFilesRaw.files ?? (serviceFilesRaw as unknown as Array<unknown>)
  const serviceContentByPath = new Map<string, string>()

  if (Array.isArray(serviceFiles)) {
    for (const f of serviceFiles) {
      const path = (f as { physicalPath?: string }).physicalPath
        ?? (f as { physical_path?: string }).physical_path ?? ""
      if (!path) continue
      // Fetch content for comparison
      const detail = await client.getFile(path) as { content?: string; contentText?: string }
      const content = detail.content ?? detail.contentText ?? ""
      serviceContentByPath.set(path, content)
    }
  }

  const rows: Array<{ file: string; action: string; hash: string }> = []

  for (const { servicePath, content } of localFiles) {
    const serviceContent = serviceContentByPath.get(servicePath)
    const localHash = contentHash(content)

    if (serviceContent !== undefined && serviceContent === content) {
      rows.push({ file: servicePath, action: "skip (unchanged)", hash: localHash })
    } else {
      const action = serviceContent === undefined ? "write (new)" : "write (updated)"
      rows.push({ file: servicePath, action: dryRun ? `[dry-run] ${action}` : action, hash: localHash })
      if (!dryRun) {
        await client.writeFile(servicePath, content, "ci-deploy")
      }
    }
  }

  if (jsonMode) {
    printJson({ dryRun, files: rows })
    return
  }

  printTable(rows, ["file", "action", "hash"])
  const written = rows.filter((r) => r.action.startsWith("write")).length
  const skipped = rows.length - written

  if (dryRun) {
    process.stdout.write(`\n[dry-run] ${written} file(s) would be written, ${skipped} unchanged\n`)
    process.stdout.write(`→ Remove --dry-run to apply\n`)
  } else {
    process.stdout.write(`\n${written} file(s) written, ${skipped} unchanged\n`)
    if (written > 0) {
      process.stdout.write(`→ Agents will use the updated shared memory on their next call\n`)
    }
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function sharedCommand(
  sub: string | undefined,
  args: ParsedArgs,
  client: AdminClient,
  jsonMode: boolean,
): Promise<void> {
  if (!sub || sub === "--help" || sub === "-h") {
    process.stdout.write(HELP)
    return
  }

  if (sub === "pull") {
    await pullShared(args, client, jsonMode)
    return
  }

  if (sub === "push") {
    await pushShared(args, client, jsonMode)
    return
  }

  printError(`Unknown subcommand: ${sub}. Run 'memex-admin shared --help'`)
  process.exit(1)
}
