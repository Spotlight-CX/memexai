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
      after_heading: string
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
