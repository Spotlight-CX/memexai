import { generateText, jsonSchema } from "ai"
import type { Db } from "./db"
import { HttpError } from "./errors"

export type ChatMessage = { role: "user" | "assistant"; content: string }

type ProposedChange = {
  path: string
  content: string
  currentContent: string | null
  isNew: boolean
}

export async function handleConfigureChat(
  db: Db,
  model: unknown,
  input: { message: string; history: ChatMessage[] },
) {
  if (!model) {
    throw new HttpError(
      503,
      "MODEL_NOT_CONFIGURED",
      "Configure chat requires a configured LLM. Set GEMINI_API_KEY (or OPENAI_API_KEY / OLLAMA_MODEL) in your environment.",
    )
  }

  const { rows } = await db.query<{ physical_path: string; content_text: string }>(
    "SELECT physical_path, content_text FROM mx_file WHERE physical_path LIKE 'shared/%' AND physical_path NOT LIKE 'shared/.%' ORDER BY physical_path ASC",
  )

  const sharedFilesContext = rows.length
    ? rows.map((row) => `=== ${row.physical_path} ===\n${row.content_text}`).join("\n\n")
    : "(no shared files exist yet)"

  const proposedChanges: ProposedChange[] = []

  const result = await generateText({
    model: model as never,
    system: [
      "You are a memory configuration assistant for memexai.",
      "Help the operator configure how agents manage memory for their product.",
      "The shared/ directory contains read-only context that guides all agents across all users.",
      "",
      "Rules:",
      "- shared/index.md is a stable root driver. Only update it to add/remove reference lines when files are created or removed.",
      "- shared/user-memory.md defines general memory management behavior for users.",
      "- For domain-specific guidance, create or update files like shared/domain.md.",
      "- Never rewrite shared/index.md wholesale — only patch reference lines.",
      "- When creating a new file, also propose an update to shared/index.md to add a one-line reference.",
      "",
      "Use the propose_change tool for each file you want to create or update.",
      "Then write a concise response explaining what you proposed and why.",
      "",
      "Current shared memory files:",
      sharedFilesContext,
    ].join("\n"),
    messages: [
      ...input.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: input.message },
    ],
    tools: {
      propose_change: {
        description: "Propose a new or updated shared/ memory file.",
        inputSchema: jsonSchema({
          type: "object",
          required: ["path", "content"],
          additionalProperties: false,
          properties: {
            path: { type: "string", description: "e.g. shared/domain.md" },
            content: { type: "string", description: "Full proposed file content" },
          },
        }),
        execute: async (args: unknown) => {
          const { path, content } = args as { path: string; content: string }
          if (!path.startsWith("shared/")) return { error: "Path must start with shared/" }
          const existing = rows.find((r) => r.physical_path === path)
          proposedChanges.push({
            path,
            content,
            currentContent: existing?.content_text ?? null,
            isNew: !existing,
          })
          return { proposed: true, path }
        },
      },
    },
    maxSteps: 10,
  })

  return { reply: result.text, proposedChanges }
}
