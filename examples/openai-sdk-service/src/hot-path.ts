import { MemexAI } from "@memexai/sdk"

const memory = new MemexAI({
  url: process.env["MEMEX_URL"] ?? "http://localhost:8080",
  apiKey: process.env["MEMEX_API_KEY"] ?? "dev-agent-key",
}).forUser({
  userId: process.env["MEMEX_USER_ID"] ?? "openai_sdk_hot_path_user",
  actor: "openai-sdk-hot-path",
})

const result = await memory.remember({
  text: "Remember that I prefer OpenAI-compatible tool loops with stable tool call IDs.",
})

console.log("hot_path: awaited memory.remember before returning the user-visible result")
console.log(`writes: ${result.writes.map((write) => write.path).join(", ") || "none"}`)
