import { createMemex } from "@memexai/core"

const DATABASE_URL = process.env["DATABASE_URL"]
if (!DATABASE_URL) throw new Error("DATABASE_URL is required")

const memex = createMemex(DATABASE_URL)
await memex.migrate()

const user = memex.forUser({ userId: process.env["USER_ID"] ?? "anthropic_direct_hot_path_user", actor: "anthropic-direct-hot-path" })
const result = await user.write(
  "user/preferences.md",
  "# Preferences\n\n- Prefers Anthropic direct-mode examples for local Postgres apps.\n",
  "hot-path explicit save",
)

console.log("hot_path: direct raw write awaited before finishing the turn")
console.log(result)

await memex.end()
