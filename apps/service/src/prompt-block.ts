import type { Db } from "./db"
import type { ToolContext } from "./paths"
import { getAgenticToolDefinitions, getRawToolDefinitions, resolveMemoryPermissions, type MemoryPermissions } from "@memexai/core"

async function readOptionalFile(db: Db, physicalPath: string): Promise<string | null> {
  const { rows } = await db.query<{ content_text: string }>(
    "SELECT content_text FROM mx_file WHERE physical_path = $1",
    [physicalPath],
  )
  return rows[0]?.content_text ?? null
}

function writableMemoryPrompt(permissions: MemoryPermissions): string {
  return permissions.writableMounts.includes("shared")
    ? "Writable memory lives under user/** and shared/**. Use shared/** only for durable global knowledge, project canon, policies, style rules, workflow lessons, and cross-user insights. Never store private user facts in shared/**. Prefer memory_patch over memory_write for shared files."
    : "Writable user memory lives under user/**. Shared memory lives under shared/** and is read-only."
}

export async function buildPromptBlock(db: Db, ctx: ToolContext, permissions: MemoryPermissions = resolveMemoryPermissions()): Promise<string> {
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
    "You have access to MemexAI memory. Use it to make later responses reflect durable memory from prior turns and sessions.",
    "Tools alone do not make memory useful: retrieve relevant memory before answering when stored context could change the response.",
    "Prefer the agentic memory tools: memory_remember to remember durable facts, and memory_context to retrieve memory.",
    "MemexAI handles file bookkeeping for agentic tools. Use virtual paths only if raw tools are explicitly provided.",
    writableMemoryPrompt(permissions),
    "Never use physical paths such as users/{userId}/... .",
    "",
    "<recommended_tools>",
    JSON.stringify(getAgenticToolDefinitions(permissions), null, 2),
    "</recommended_tools>",
    "<raw_tools>",
    JSON.stringify(getRawToolDefinitions(permissions), null, 2),
    "</raw_tools>",
    docs.length ? ["", ...docs].join("\n") : "",
    "</memexai_memory>",
  ].filter(Boolean).join("\n")
}
