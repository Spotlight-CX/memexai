import { MemexAI } from "@memexai/sdk"

const memory = new MemexAI({
  url: process.env["MEMEX_URL"] ?? "http://localhost:8080",
  apiKey: process.env["MEMEX_API_KEY"] ?? "dev-agent-key",
}).forUser({
  userId: process.env["MEMEX_USER_ID"] ?? "anthropic_service_background_user",
  actor: "anthropic-service-background-path",
})

console.log("background_path: after the Anthropic Messages tool-use loop returns, extract durable facts")
const insight = "http_client permanent failure: the API limits request bodies to 256 KiB."
const result = await memory.remember({ text: insight, toolCallId: "anthropic_background_http_client" })

console.log(`learned_after_response: ${insight}`)
console.log(`writes: ${result.writes.map((write) => write.path).join(", ") || "none"}`)
