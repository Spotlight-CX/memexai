import { config as loadEnv } from "dotenv"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { MemexAI } from "@memexai/sdk"

const here = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(here, "../../../.env"), quiet: true })
loadEnv({ path: resolve(here, "../.env"), override: true, quiet: true })

const memex = new MemexAI({
  url: process.env["MEMEX_URL"] ?? "http://localhost:8080",
  apiKey: process.env["MEMEX_API_KEY"] ?? "dev-agent-key",
})
const memory = memex.forUser({
  userId: process.env["MEMEX_USER_ID"] ?? "example_vercel_ai_background_user",
  actor: "vercel-ai-background-path",
})

console.log("background_path: user response can finish before extraction")
console.log("assistant: Got it. I will use LOWER(...) LIKE LOWER(...) for this SQL dialect.")

const appToolResult = {
  toolName: "run_sql",
  permanent: true,
  error: "ILIKE is not supported in this SQL dialect; use LOWER(column) LIKE LOWER(pattern).",
}
const insight = `${appToolResult.toolName} permanent failure: ${appToolResult.error}`

await memory.remember({ text: insight, toolCallId: "vercel_background_run_sql" })
console.log(`learned_after_response: ${insight}`)
