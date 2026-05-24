import type { Db } from "./db"
import type { ToolContext } from "./paths"
import { agenticToolDefinitions, rawToolDefinitions } from "@memexai/core"

async function readOptionalFile(db: Db, physicalPath: string): Promise<string | null> {
  const { rows } = await db.query<{ content_text: string }>(
    "SELECT content_text FROM mx_file WHERE physical_path = $1",
    [physicalPath],
  )
  return rows[0]?.content_text ?? null
}

export async function buildPromptBlock(db: Db, ctx: ToolContext): Promise<string> {
  const [sharedResult, userIndex] = await Promise.all([
    db.query<{ physical_path: string; content_text: string }>(
      "SELECT physical_path, content_text FROM mx_file WHERE physical_path LIKE 'shared/%' AND physical_path NOT LIKE 'shared/.%' ORDER BY physical_path ASC",
    ),
    readOptionalFile(db, `users/${ctx.userId}/index.md`),
  ])

  const docs = [
    ...sharedResult.rows.map(
      (row) => `<shared_file path="${row.physical_path}">\n${row.content_text}\n</shared_file>`,
    ),
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
