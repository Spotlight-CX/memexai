import { MemexAIError, type MemexAIErrorBody } from "./errors"
import { agenticToolDefinitions, rawToolDefinitions } from "./tool-definitions"
import type {
  ListFilesInput,
  MemoryContext,
  MemoryFile,
  MemorizeInput,
  MemorizeResult,
  MemexAIOptions,
  PatchFileInput,
  PatchFileResult,
  ReadFileInput,
  ReadFileResult,
  RequestContext,
  SearchMemoryInput,
  SearchMemoryResult,
  WriteFileInput,
  WriteFileResult,
} from "./types"
import { jsonSchema } from "ai"

type ExecuteToolInput = {
  name: string
  arguments: unknown
  context: RequestContext
}

type VercelAITool = {
  description: string
  inputSchema: ReturnType<typeof jsonSchema>
  execute: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>
}

export class MemexAI {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch

  constructor(options: MemexAIOptions) {
    if (!options.url) throw new MemexAIError("INVALID_OPTIONS", "url is required")
    if (!options.apiKey) throw new MemexAIError("INVALID_OPTIONS", "apiKey is required")

    this.baseUrl = options.url.replace(/\/+$/, "")
    this.apiKey = options.apiKey
    this.fetchImpl = options.fetch ?? globalThis.fetch

    if (!this.fetchImpl) {
      throw new MemexAIError("FETCH_UNAVAILABLE", "A fetch implementation is required")
    }
  }

  forUser(context: MemoryContext): MemexMemory {
    return new MemexMemory(this, context)
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...jsonHeaders(options.body),
        ...options.headers,
      },
    })

    const bodyText = await response.text()
    const body = bodyText ? parseJson(bodyText) : null

    if (!response.ok) {
      const errorBody = body as MemexAIErrorBody | null
      const code = errorBody?.error?.code ?? `HTTP_${response.status}`
      const message = errorBody?.error?.message ?? response.statusText
      throw new MemexAIError(code, message, response.status, errorBody?.error?.issues)
    }

    return body as T
  }

  async executeTool<T>(input: ExecuteToolInput): Promise<T> {
    return this.request<T>(`/v1/tools/${encodeURIComponent(input.name)}/execute`, {
      method: "POST",
      body: JSON.stringify({
        context: input.context,
        arguments: input.arguments,
      }),
    })
  }
}

export class MemexMemory {
  constructor(
    private readonly client: MemexAI,
    private readonly context: MemoryContext,
  ) {
    if (!context.userId) {
      throw new MemexAIError("USER_ID_REQUIRED", "userId is required")
    }
  }

  async getPromptBlock(): Promise<string> {
    const params = new URLSearchParams({ userId: this.context.userId })
    if (this.context.actor) params.set("actor", this.context.actor)
    const result = await this.client.request<{ promptBlock: string }>(`/v1/prompt-block?${params.toString()}`)
    return result.promptBlock
  }

  async listFiles(input: ListFilesInput = {}): Promise<{ files: MemoryFile[] }> {
    return this.client.executeTool({
      name: "memory_list",
      context: this.context,
      arguments: input,
    })
  }

  async readFile(input: ReadFileInput): Promise<ReadFileResult> {
    return this.client.executeTool({
      name: "memory_read",
      context: this.context,
      arguments: input,
    })
  }

  async writeFile(input: WriteFileInput): Promise<WriteFileResult> {
    const { toolCallId, ...args } = input
    return this.client.executeTool({
      name: "memory_write",
      context: withToolCallId(this.context, toolCallId),
      arguments: args,
    })
  }

  async patchFile(input: PatchFileInput): Promise<PatchFileResult> {
    const { toolCallId, ...args } = input
    return this.client.executeTool({
      name: "memory_patch",
      context: withToolCallId(this.context, toolCallId),
      arguments: args,
    })
  }

  async search(input: SearchMemoryInput | string): Promise<SearchMemoryResult> {
    const normalized = typeof input === "string" ? { query: input } : input
    const { toolCallId, ...args } = normalized
    return this.client.executeTool({
      name: "memory_search",
      context: withToolCallId(this.context, toolCallId),
      arguments: args,
    })
  }

  async memorize(input: MemorizeInput | string): Promise<MemorizeResult> {
    const normalized = typeof input === "string" ? { text: input } : input
    const { toolCallId, ...args } = normalized
    return this.client.executeTool({
      name: "memory_memorize",
      context: withToolCallId(this.context, toolCallId),
      arguments: args,
    })
  }

  createAgenticToolset(): Record<string, VercelAITool> {
    return this.createToolset(agenticToolDefinitions)
  }

  createRawToolset(): Record<string, VercelAITool> {
    return this.createToolset(rawToolDefinitions)
  }

  private createToolset(definitions: typeof agenticToolDefinitions | typeof rawToolDefinitions): Record<string, VercelAITool> {
    return Object.fromEntries(definitions.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonSchema(tool.inputSchema),
        execute: (args: unknown, options?: { toolCallId?: string }) => this.executeTool({
          name: tool.name,
          arguments: args,
          toolCallId: options?.toolCallId,
        }),
      },
    ]))
  }

  async executeTool<T = unknown>(input: { name: string; arguments: unknown; toolCallId?: string }): Promise<T> {
    return this.client.executeTool({
      name: input.name,
      context: withToolCallId(this.context, input.toolCallId),
      arguments: input.arguments,
    })
  }
}

function withToolCallId(context: MemoryContext, toolCallId: string | undefined): RequestContext {
  return toolCallId ? { ...context, toolCallId } : context
}

function jsonHeaders(body: BodyInit | null | undefined): Record<string, string> {
  return typeof body === "string" ? { "content-type": "application/json" } : {}
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    throw new MemexAIError("INVALID_JSON_RESPONSE", "MemexAI service returned invalid JSON")
  }
}
