import { existsSync, statSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve, relative, extname } from "node:path"
import { HttpError } from "./errors"

const DOCS_ROOT_ENV = process.env["MEMEX_DOCS_PATH"]

// Resolve docs root: env override → two levels up from this file (repo root/docs)
function getDocsRoot(): string {
  if (DOCS_ROOT_ENV) return resolve(DOCS_ROOT_ENV)
  // __dirname = apps/service/src → go up 3 levels to repo root, then docs/
  return resolve(import.meta.dirname, "../../../docs")
}

function safePath(docsRoot: string, requestedPath: string): string {
  const cleaned = requestedPath.replace(/\\/g, "/").replace(/^\/+/, "")
  const full = resolve(join(docsRoot, cleaned))
  if (!full.startsWith(docsRoot + "/") && full !== docsRoot) {
    throw new HttpError(400, "PATH_TRAVERSAL", "Path traversal is not allowed")
  }
  return full
}

export type DocFileSummary = {
  path: string
  size: number
  updatedAt: string
}

export type DocFileDetail = {
  path: string
  content: string
  size: number
  updatedAt: string
}

function walkMd(dir: string, base: string): DocFileSummary[] {
  const results: DocFileSummary[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkMd(full, base))
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      const stat = statSync(full)
      results.push({
        path: relative(base, full),
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      })
    }
  }
  return results
}

export function listDocs(): { files: DocFileSummary[] } {
  const root = getDocsRoot()
  if (!existsSync(root)) return { files: [] }
  return { files: walkMd(root, root) }
}

export function getDoc(requestedPath: string): DocFileDetail {
  const root = getDocsRoot()
  if (!existsSync(root)) {
    throw new HttpError(404, "DOCS_NOT_FOUND", "Docs directory not configured")
  }

  const full = safePath(root, requestedPath)

  if (!existsSync(full)) {
    throw new HttpError(404, "DOC_NOT_FOUND", `Doc not found: ${requestedPath}`)
  }

  const stat = statSync(full)
  if (!stat.isFile()) {
    throw new HttpError(400, "NOT_A_FILE", "Path resolves to a directory; use listing")
  }
  if (extname(full) !== ".md") {
    throw new HttpError(400, "UNSUPPORTED_TYPE", "Only .md files are served")
  }

  const content = readFileSync(full, "utf8")
  return {
    path: relative(root, full),
    content,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
  }
}
