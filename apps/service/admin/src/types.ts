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
  matchedRevision?: {
    id: string
    fileId: string
    operation: string
    actor: string | null
    reason: string | null
    userId: string | null
    toolCallId: string | null
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
  normalizedPath?: string
  reads: number
  writes: number
  searches: number
  smartReads: number
  totalHits: number
  uniqueUsers: number
  size: number | null
  lastAccessedAt: string | null
}

export type ObservabilityTreeNode = {
  normalizedPath: string
  label: string
  parentPath: string | null
  kind: "folder" | "file"
  depth: number
  reads: number
  writes: number
  searches: number
  smartReads: number
  totalHits: number
  uniqueUsers: number
  revisions: number
  files: number
  size: number | null
  p95Ms: number | null
  errors: number
  newFiles: number
  updatedFiles: number
  staleFiles: number
  lastAccessedAt: string | null
  badges: string[]
}

export type ObservabilityTree = {
  nodes: ObservabilityTreeNode[]
  selectedNode: ObservabilityTreeNode | null
  summary: {
    hotFiles: number
    coldFiles: number
    highChurn: number
    hotLargeFiles: number
    searchHeavy: number
    revisions: number
    newFiles: number
    updatedFiles: number
    staleFiles: number
  }
  hygiene: {
    hotFiles: ObservabilityTreeNode[]
    coldFiles: ObservabilityTreeNode[]
    highChurn: ObservabilityTreeNode[]
    hotLargeFiles: ObservabilityTreeNode[]
    searchHeavy: ObservabilityTreeNode[]
    sharedUsage: ObservabilityTreeNode[]
  }
}

export type ObservabilityTreeNodeDetail = {
  node: ObservabilityTreeNode | null
  topConcretePaths: ObservabilityFileCount[]
  topScopes: Array<{ userId: string | null; count: number; lastSeenAt: string | null }>
  coHitNodes: Array<{ normalizedPath: string; count: number; lastSeenAt: string | null }>
  activity: Array<{
    bucketStart: string
    reads: number
    writes: number
    searches: number
    smartReads: number
  }>
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

export type SchemaFileSignal = {
  physicalPath: string
  size: number | null
  count: number
  lastSeenAt: string | null
}

export type ObservabilitySchemaSignals = {
  hotLargeFiles: SchemaFileSignal[]
  coldFiles: SchemaFileSignal[]
  coHitFiles: Array<{
    sourcePath: string
    relatedPath: string
    count: number
    lastSeenAt: string | null
  }>
  rewriteChurn: SchemaFileSignal[]
  sharedUsage: SchemaFileSignal[]
  searchHeavyUsers: Array<{
    userId: string | null
    count: number
    lastSeenAt: string | null
  }>
}

export type FileObservability = {
  summary: {
    reads: number
    writes: number
    searches: number
    smartReads: number
    revisions: number
    uniqueUsers: number
    lastAccessedAt: string | null
    lastWrittenAt: string | null
    p95Ms: number | null
  }
  activity: Array<{
    bucketStart: string
    reads: number
    writes: number
    searches: number
    smartReads: number
  }>
  topUsers: Array<{
    userId: string | null
    reads: number
    writes: number
    searches: number
    lastAccessedAt: string | null
  }>
  coHitFiles: ObservabilityFileCount[]
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
