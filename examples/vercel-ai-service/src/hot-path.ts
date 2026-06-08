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
  userId: process.env["MEMEX_USER_ID"] ?? "example_vercel_ai_hot_path_user",
  actor: "vercel-ai-hot-path",
})

const userMessage = "Remember that I prefer ceramic pour-over coffee with oat milk."
const result = await memory.remember({ text: userMessage })

console.log("hot_path: awaited memory.remember before finishing the turn")
console.log(`writes: ${result.writes.map((write) => write.path).join(", ") || "none"}`)
