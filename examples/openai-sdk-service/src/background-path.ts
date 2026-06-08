import { MemexAI } from "@memexai/sdk"

const memory = new MemexAI({
  url: process.env["MEMEX_URL"] ?? "http://localhost:8080",
  apiKey: process.env["MEMEX_API_KEY"] ?? "dev-agent-key",
}).forUser({
  userId: process.env["MEMEX_USER_ID"] ?? "openai_sdk_background_user",
  actor: "openai-sdk-background-path",
})

console.log("background_path: complete the user response, then learn from app tool results")
console.log("assistant: I found the SQL incompatibility and adjusted the query.")

const toolResult = {
  toolName: "run_sql",
  ok: false,
  permanent: true,
  error: "ILIKE is not supported in this SQL dialect; use LOWER(column) LIKE LOWER(pattern).",
}

if (!toolResult.ok && toolResult.permanent) {
  const insight = `${toolResult.toolName} permanent failure: ${toolResult.error}`
  const result = await memory.remember({ text: insight, toolCallId: "openai_background_run_sql" })
  console.log(`learned_after_response: ${insight}`)
  console.log(`writes: ${result.writes.map((write) => write.path).join(", ") || "none"}`)
}
