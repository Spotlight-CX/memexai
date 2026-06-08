import { createMemex } from "@memexai/core"

const DATABASE_URL = process.env["DATABASE_URL"]
if (!DATABASE_URL) throw new Error("DATABASE_URL is required")

const memex = createMemex(DATABASE_URL)
await memex.migrate()

const user = memex.forUser({ userId: process.env["USER_ID"] ?? "vercel_ai_direct_hot_path_user", actor: "vercel-ai-direct-hot-path" })
const result = await user.write(
  "user/preferences.md",
  "# Preferences\n\n- Prefers direct Postgres memory for single-process apps.\n",
  "hot-path explicit save",
)

console.log("hot_path: direct Postgres raw write awaited before finishing the turn")
console.log(result)

await memex.end()
