import type { Db } from "./db"
import type { ToolContext } from "./paths"
import { agenticToolDefinitions, rawToolDefinitions } from "./tool-definitions"

async function readOptionalFile(db: Db, physicalPath: string): Promise<string | null> {
  const { rows } = await db.query<{ content_text: string }>(
    "SELECT content_text FROM mx_file WHERE physical_path = $1",
    [physicalPath],
  )
  return rows[0]?.content_text ?? null
}

export async function buildPromptBlock(db: Db, ctx: ToolContext): Promise<string> {
  const [sharedIndex, sharedClaude, userIndex] = await Promise.all([
    readOptionalFile(db, "shared/index.md"),
    readOptionalFile(db, "shared/claude.md"),
    readOptionalFile(db, `users/${ctx.userId}/index.md`),
  ])

  const docs = [
    sharedIndex ? `<shared_index path="shared/index.md">\n${sharedIndex}\n</shared_index>` : null,
    sharedClaude ? `<shared_instructions path="shared/claude.md">\n${sharedClaude}\n</shared_instructions>` : null,
    userIndex ? `<user_index path="user/index.md">\n${userIndex}\n</user_index>` : null,
  ].filter(Boolean)

  return [
    "<memexai_memory>",
    "You have access to MemexAI memory.",
    "Prefer the agentic memory tools: memory_memorize to remember durable facts, and memory_search to retrieve memory.",
    "MemexAI handles file bookkeeping for agentic tools. Use virtual paths only if raw tools are explicitly provided.",
    "Writable user memory lives under user/**. Shared memory lives under shared/** and is read-only.",
    "Never use physical paths such as users/{userId}/... .",
    "",
    "<recommended_tools>",
    JSON.stringify(agenticToolDefinitions, null, 2),
    "</recommended_tools>",
    "<raw_tools>",
    JSON.stringify(rawToolDefinitions, null, 2),
    "</raw_tools>",
    docs.length ? ["", ...docs].join("\n") : "",
    "</memexai_memory>",
  ].filter(Boolean).join("\n")
}
