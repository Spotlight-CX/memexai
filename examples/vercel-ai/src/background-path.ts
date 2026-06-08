import { createMemex } from "@memexai/core"

const DATABASE_URL = process.env["DATABASE_URL"]
if (!DATABASE_URL) throw new Error("DATABASE_URL is required")

const memex = createMemex(DATABASE_URL)
await memex.migrate()

const user = memex.forUser({ userId: process.env["USER_ID"] ?? "vercel_ai_direct_background_user", actor: "vercel-ai-direct-background-path" })
const insight = "direct tool permanent failure: Gemini function calling requires valid JSON-schema-compatible tool input."
const result = await user.write(
  "user/tool-quirks.md",
  `# Tool quirks\n\n- ${insight}\n`,
  "background extraction",
)

console.log("background_path: direct app extracted a durable insight after the response")
console.log(result)

await memex.end()
