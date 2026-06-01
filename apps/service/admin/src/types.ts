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

export type ObservabilitySummary = {
  totals: {
    toolCalls: number
    promptBlocks: number
    activeUsers: number
    fileHits: number
    reads: number
    writes: number
    searches: number
    smartReads: number
    errors: number
  }
  latency: {
    p50Ms: number | null
    p95Ms: number | null
    slowestToolName: string | null
  }
  ratios: {
    errorRate: number
    readWriteRatio: number | null
  }
}

export type ObservabilityBucket = {
  bucketStart: string
  reads: number
  writes: number
  searches: number
  smartReads: number
  toolCalls: number
  errors: number
  p50Ms: number | null
  p95Ms: number | null
}

export type ObservabilityTopFile = {
  physicalPath: string
  reads: number
  writes: number
  searches: number
  smartReads: number
  totalHits: number
  uniqueUsers: number
  size: number | null
  lastAccessedAt: string | null
}

export type ObservabilityEvent = {
  id: string
  eventType: string
  status: string
  durationMs: number | null
  userId: string | null
  actor: string | null
  toolName: string | null
  operation: string | null
  physicalPath: string | null
  toolCallId: string | null
  errorCode: string | null
  attributes: Record<string, unknown>
  createdAt: string
}

export type ObservabilityFileCount = {
  physicalPath: string
  count: number
  lastSeenAt: string | null
}

export type UserMemoryObservability = {
  userId: string | null
  summary: {
    filesRead: number
    filesWritten: number
    searches: number
    failedCalls: number
    p95Ms: number | null
  }
  topReadFiles: ObservabilityFileCount[]
  topWrittenFiles: ObservabilityFileCount[]
  rewrittenFiles: ObservabilityFileCount[]
  rarelyReadFiles: ObservabilityFileCount[]
  recentEvents: ObservabilityEvent[]
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
