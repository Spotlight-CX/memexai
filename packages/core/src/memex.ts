import { createPool, type Db } from "./db"
import { runMigrations } from "./migrations"
import type { ToolContext } from "./paths"
import { buildPromptBlock } from "./prompt-block"
import { toolDefinitions } from "./tool-definitions"
import { executeTool } from "./tools"

export class Memex {
  constructor(private readonly db: Db) {}

  async migrate(): Promise<void> {
    await runMigrations(this.db)
  }

  getTools() {
    return toolDefinitions
  }

  async executeTool<T = unknown>(toolName: string, args: unknown, ctx: ToolContext): Promise<T> {
    return executeTool(this.db, toolName, args, ctx) as Promise<T>
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

  async executeTool<T = unknown>(toolName: string, args: unknown, toolCallId?: string): Promise<T> {
    return this.memex.executeTool(toolName, args, toolCallId ? { ...this.ctx, toolCallId } : this.ctx)
  }
}

export function createMemex(databaseUrl: string): Memex {
  const db = createPool(databaseUrl)
  return new Memex(db)
}
