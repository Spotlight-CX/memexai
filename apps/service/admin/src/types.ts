import type { TreeNodeData } from "@mantine/core"

export type AdminUser = {
  userId: string
  fileCount: number
  lastWriteAt: string | null
  lastReadAt: string | null
}

export type AdminFile = {
  id: string
  physicalPath: string
  size: number
  createdAt: string
  updatedAt: string
  content?: string
  latestRevision?: {
    operation: string
    actor: string | null
    reason: string | null
    createdAt: string
  } | null
  revisionCount?: number
}

export type AdminRevision = {
  id: string
  physicalPath: string
  operation: string
  content: string
  reason: string | null
  actor: string | null
  userId: string | null
  toolCallId: string | null
  createdAt: string
}

export type AdminAccessLog = {
  id: string
  physicalPath: string
  operation: string
  actor: string | null
  userId: string | null
  toolCallId: string | null
  createdAt: string
}

export type AdminDreamUser = {
  userId: string
  status: "idle" | "running" | "completed" | "failed" | string
  paused: boolean
  lastDreamedAt: string | null
  lastStartedAt: string | null
  filesTouched: number | null
  error: string | null
  dreamCount: number
  updatedAt: string
}

export type AdminDreamConfigRow = {
  key: string
  value: string
  description: string | null
  updatedAt: string
}

export type Pagination = {
  limit: number
  offset: number
  total: number
  hasMore: boolean
}

export type FileTreeNode = TreeNodeData & {
  kind: "folder" | "file"
  children?: FileTreeNode[]
}

export type Overlay = "users" | "revisions" | "logs" | null
