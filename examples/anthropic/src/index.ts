import Anthropic from "@anthropic-ai/sdk"
import { createMemex } from "@memexai/core"
import { createAnthropicTools, handleAnthropicToolCall } from "@memexai/core/adapters/anthropic"

const DATABASE_URL = process.env["DATABASE_URL"]
if (!DATABASE_URL) throw new Error("DATABASE_URL is required")

const ANTHROPIC_API_KEY = process.env["ANTHROPIC_API_KEY"]
if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required")

const USER_ID = process.env["USER_ID"] ?? "demo_user"
const prompt = process.argv[2] ?? "Remember that I prefer quiet neighborhoods near good schools."

const memex = createMemex(DATABASE_URL)
await memex.migrate()

const user = memex.forUser({ userId: USER_ID, actor: "assistant" })
const promptBlock = await user.getPromptBlock()
const tools = createAnthropicTools(user)

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }]

for (let step = 0; step < 5; step++) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      "You are a helpful assistant with durable memory.",
      "Use memory tools to remember stable facts the user shares.",
      "Write user-specific notes under user/**.",
      "",
      promptBlock,
    ].join("\n"),
    tools,
    messages,
  })

  messages.push({ role: "assistant", content: response.content })

  if (response.stop_reason !== "tool_use") {
    const text = response.content.find((b) => b.type === "text")?.text ?? ""
    console.log("\nAssistant:", text)
    break
  }

  const toolResults: Anthropic.ToolResultBlockParam[] = []
  for (const block of response.content) {
    if (block.type !== "tool_use") continue
    const result = await handleAnthropicToolCall(block.name, block.input, user, undefined, block.id)
    toolResults.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: JSON.stringify(result),
    })
  }

  messages.push({ role: "user", content: toolResults })
}

console.log(`\nMemory written. Run: npx memex-admin --database-url ${DATABASE_URL}`)

await memex.end()
