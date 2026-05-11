import type { Db } from "./db"
import type { ToolContext } from "./paths"
import { toolDefinitions } from "./tool-definitions"

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
    "You have access to MemexAI memory tools.",
    "Use virtual paths only. Writable user memory lives under user/**. Shared product memory lives under shared/** and is read-only.",
    "Do not use physical paths such as users/{userId}/... . Create files directly by writing slash-delimited user/** paths; folders are inferred from path prefixes.",
    "",
    "<available_tools>",
    JSON.stringify(toolDefinitions, null, 2),
    "</available_tools>",
    docs.length ? ["", ...docs].join("\n") : "",
    "</memexai_memory>",
  ].filter(Boolean).join("\n")
}
