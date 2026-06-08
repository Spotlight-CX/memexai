import { MemexAI } from "@memexai/sdk"

const memory = new MemexAI({
  url: process.env["MEMEX_URL"] ?? "http://localhost:8080",
  apiKey: process.env["MEMEX_API_KEY"] ?? "dev-agent-key",
}).forUser({
  userId: process.env["MEMEX_USER_ID"] ?? "anthropic_service_hot_path_user",
  actor: "anthropic-service-hot-path",
})

const result = await memory.remember({
  text: "Remember that I prefer Anthropic tool-use loops with explicit tool_result blocks.",
})

console.log("hot_path: awaited memory.remember before finishing the turn")
console.log(`writes: ${result.writes.map((write) => write.path).join(", ") || "none"}`)
