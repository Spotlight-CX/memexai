import { createPool, type Db } from "./db"
import { runMigrations } from "./migrations"
import { resolveMemoryPermissions, type MemoryPermissions, type SharedWriteMode, type ToolContext } from "./paths"
import { buildPromptBlock } from "./prompt-block"
import { getAgenticToolDefinitions, getRawToolDefinitions, getToolDefinitions, type ToolDefinition } from "./tool-definitions"
import { executeTool } from "./tools"
import { jsonSchema } from "ai"

type VercelAITool = {
  description: string
  inputSchema: ReturnType<typeof jsonSchema>
  execute: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>
}

export class Memex {
  private readonly permissions: MemoryPermissions

  constructor(
    private readonly db: Db,
    private readonly model?: unknown,
    input: { sharedWriteMode?: SharedWriteMode; permissions?: MemoryPermissions } = {},
  ) {
    this.permissions = input.permissions ?? resolveMemoryPermissions({ sharedWriteMode: input.sharedWriteMode })
  }

  async migrate(): Promise<void> {
    await runMigrations(this.db)
  }

  getTools() {
    return getToolDefinitions(this.permissions)
  }

  getAgenticTools() {
    return getAgenticToolDefinitions(this.permissions)
  }

  getRawTools() {
    return getRawToolDefinitions(this.permissions)
  }

  async executeTool<T = unknown>(toolName: string, args: unknown, ctx: ToolContext): Promise<T> {
    return executeTool(this.db, toolName, args, ctx, { model: this.model, permissions: this.permissions }) as Promise<T>
  }

  getModel(): unknown | undefined {
    return this.model
  }

  async getPromptBlock(ctx: ToolContext): Promise<string> {
    return buildPromptBlock(this.db, ctx, this.permissions)
  }

  forUser(ctx: ToolContext): MemexUser {
    return new MemexUser(this, ctx)
  }

  async end(): Promise<void> {
    await this.db.end()
  }
}

export class MemexUser {
  constructor(
    private readonly memex: Memex,
    private readonly ctx: ToolContext,
  ) {}

  async getPromptBlock(): Promise<string> {
    return this.memex.getPromptBlock(this.ctx)
  }

  async getSystemPrompt(basePrompt: string): Promise<string> {
    const promptBlock = await this.getPromptBlock()
    return [basePrompt.trim(), promptBlock].filter(Boolean).join("\n\n")
  }

  getTools() {
    return this.memex.getTools()
  }

  async list(prefix?: string) {
    return this.memex.executeTool<{ files: { path: string; size: number; updatedAt: Date }[] }>(
      "memory_list",
      { prefix },
      this.ctx,
    )
  }

  async read(path: string) {
    return this.memex.executeTool<{ path: string; content: string; updatedAt: Date }>(
      "memory_read",
      { path },
      this.ctx,
    )
  }

  async write(path: string, content: string, reason?: string) {
    return this.memex.executeTool<{ path: string; created: boolean; updated: boolean }>(
      "memory_write",
      { path, content, reason },
      this.ctx,
    )
  }

  async search(query: string, options: { maxChars?: number; limit?: number; maxReads?: number; prefix?: string } = {}) {
    return this.memex.executeTool<{
      query: string
      results: { path: string; snippet: string; rank: number; updatedAt: Date }[]
      truncated: boolean
      answer?: string
      sources?: string[]
      traceId?: string
      memory_trace_id?: string
      toolCallId?: string
      durationMs?: number
      usage?: { inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null }
      searchStats?: { searchMode?: string; candidateCount?: number; filesReturned?: number; filesRead?: number; sourcesReturned?: number }
    }>(
      "memory_search",
      { query, ...options },
      this.ctx,
    )
  }

  async memorize(text: string, options: { maxWrites?: number; dryRun?: boolean } = {}) {
    return this.memex.executeTool<{
      text: string
      dryRun: boolean
      writes: { tool: string; path: string; reason?: string; args: unknown; result?: unknown }[]
      traceId?: string
      memory_trace_id?: string
      toolCallId?: string
      durationMs?: number
      usage?: { inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null }
    }>(
      "memory_memorize",
      { text, ...options },
      this.ctx,
    )
  }

  createAgenticToolset(): Record<string, VercelAITool> {
    return this.createToolset(this.memex.getAgenticTools())
  }

  createRawToolset(): Record<string, VercelAITool> {
    return this.createToolset(this.memex.getRawTools())
  }

  private createToolset(definitions: readonly ToolDefinition[]): Record<string, VercelAITool> {
    return Object.fromEntries(definitions.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonSchema(tool.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: (args: unknown, options?: { toolCallId?: string }) => this.executeTool(
          tool.name,
          args,
          options?.toolCallId,
        ),
      },
    ]))
  }

  async executeTool<T = unknown>(toolName: string, args: unknown, toolCallId?: string): Promise<T> {
    return this.memex.executeTool(toolName, args, toolCallId ? { ...this.ctx, toolCallId } : this.ctx)
  }
}

export function createMemex(input: string | { databaseUrl: string; model?: unknown; sharedWriteMode?: SharedWriteMode }): Memex {
  const databaseUrl = typeof input === "string" ? input : input.databaseUrl
  const model = typeof input === "string" ? undefined : input.model
  const sharedWriteMode = typeof input === "string" ? undefined : input.sharedWriteMode
  const db = createPool(databaseUrl)
  return new Memex(db, model, { sharedWriteMode })
}
