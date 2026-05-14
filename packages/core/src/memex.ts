import { createPool, type Db } from "./db"
import { runMigrations } from "./migrations"
import type { ToolContext } from "./paths"
import { buildPromptBlock } from "./prompt-block"
import { agenticToolDefinitions, rawToolDefinitions, toolDefinitions, type ToolDefinition } from "./tool-definitions"
import { executeTool } from "./tools"
import { jsonSchema } from "ai"

type VercelAITool = {
  description: string
  inputSchema: ReturnType<typeof jsonSchema>
  execute: (args: unknown, options?: { toolCallId?: string }) => Promise<unknown>
}

export class Memex {
  constructor(
    private readonly db: Db,
    private readonly model?: unknown,
  ) {}

  async migrate(): Promise<void> {
    await runMigrations(this.db)
  }

  getTools() {
    return toolDefinitions
  }

  async executeTool<T = unknown>(toolName: string, args: unknown, ctx: ToolContext): Promise<T> {
    return executeTool(this.db, toolName, args, ctx, { model: this.model }) as Promise<T>
  }

  getModel(): unknown | undefined {
    return this.model
  }

  async getPromptBlock(ctx: ToolContext): Promise<string> {
    return buildPromptBlock(this.db, ctx)
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
    }>(
      "memory_memorize",
      { text, ...options },
      this.ctx,
    )
  }

  createAgenticToolset(): Record<string, VercelAITool> {
    return this.createToolset(agenticToolDefinitions)
  }

  createRawToolset(): Record<string, VercelAITool> {
    return this.createToolset(rawToolDefinitions)
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

export function createMemex(input: string | { databaseUrl: string; model?: unknown }): Memex {
  const databaseUrl = typeof input === "string" ? input : input.databaseUrl
  const model = typeof input === "string" ? undefined : input.model
  const db = createPool(databaseUrl)
  return new Memex(db, model)
}
