export type MemexAIOptions = {
  url: string
  apiKey: string
  fetch?: typeof fetch
}

export type MemoryContext = {
  userId: string
  actor?: string
}

export type RequestContext = MemoryContext & {
  toolCallId?: string
}

export type MemoryFile = {
  path: string
  size: number
  updatedAt: string
}

export type ListFilesInput = {
  prefix?: string
}

export type ReadFileInput = {
  path: string
}

export type ReadFileResult = {
  path: string
  content: string
  updatedAt: string
}

export type WriteFileInput = {
  path: string
  content: string
  reason?: string
  toolCallId?: string
}

export type WriteFileResult = {
  path: string
  created: boolean
  updated: boolean
}

export type PatchFileInput =
  | {
      path: string
      operation: "append_lines"
      after_heading?: string
      lines: string[]
      reason?: string
      toolCallId?: string
    }
  | {
      path: string
      operation: "replace_lines"
      match: string
      replacement: string | string[]
      reason?: string
      toolCallId?: string
    }

export type PatchFileResult = {
  path: string
  operation: "append_lines" | "replace_lines"
  changed: boolean
  noOp: boolean
}

export type FindMemoryInput = {
  query: string
  maxChars?: number
  limit?: number
  prefix?: string
  toolCallId?: string
}

export type FindMemoryResult = {
  query: string
  results: {
    path: string
    snippet: string
    rank: number
    matchReason?: "lexical" | "semantic" | "hybrid"
    bm25Rank?: number
    vectorRank?: number
    bm25Score?: number
    vectorDistance?: number
    updatedAt: string
  }[]
  truncated: boolean
}

export type RememberInput = {
  text: string
  maxWrites?: number
  dryRun?: boolean
  toolCallId?: string
}

export type RememberResult = {
  text: string
  dryRun: boolean
  writes: {
    tool: "memory_write" | "memory_patch"
    path: string
    reason?: string
    args: unknown
    result?: unknown
  }[]
}

export type JsonSchema = Record<string, unknown>

export type ToolDefinition = {
  name: string
  description: string
  inputSchema: JsonSchema
}

export type RetrieveContextInput = {
  maxChars?: number
  query?: string
  includeRelated?: boolean
  relatedDepth?: number
  toolCallId?: string
}

export type RetrieveContextResult = {
  context: string
  filesRead: string[]
  usage?: { inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null }
}
