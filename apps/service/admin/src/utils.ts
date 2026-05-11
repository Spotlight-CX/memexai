import type { AdminFile, FileTreeNode } from "./types"

export function formatDate(value: string | Date | null) {
  if (!value) return ""
  return new Date(value).toLocaleString()
}

export function relativeTime(value: string | Date | null): string {
  if (!value) return ""
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(value)
}

export function deriveTree(files: AdminFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const folders = new Map<string, FileTreeNode>()

  const getFolder = (path: string, label: string, siblings: FileTreeNode[]) => {
    const existing = folders.get(path)
    if (existing) return existing
    const next: FileTreeNode = { kind: "folder", value: path, label, children: [] }
    folders.set(path, next)
    siblings.push(next)
    return next
  }

  for (const file of files) {
    const parts = file.physicalPath.split("/")
    let siblings = root
    for (let index = 0; index < parts.length; index += 1) {
      const label = parts[index]
      const path = parts.slice(0, index + 1).join("/")
      const isFile = index === parts.length - 1
      if (isFile) {
        siblings.push({ kind: "file", value: file.physicalPath, label })
      } else {
        const folder = getFolder(path, label, siblings)
        siblings = folder.children ?? []
      }
    }
  }

  return sortTree(root)
}

function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
      return String(a.label).localeCompare(String(b.label))
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortTree(node.children) : undefined,
    }))
}

export function isCodeLike(content: string, path: string) {
  const ext = path.split(".").pop()?.toLowerCase()
  if (ext && ["json", "js", "jsx", "ts", "tsx", "md", "sql", "yaml", "yml", "toml", "xml", "html", "css"].includes(ext)) return true
  const trimmed = content.trim()
  if (!trimmed) return false
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return true
  return content.split("\n").some((line) => /^\s{2,}\S/.test(line) || line.includes("=>") || line.includes("function "))
}
