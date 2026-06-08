import Anthropic from "@anthropic-ai/sdk"
import { MemexAI } from "@memexai/sdk"
import { createAnthropicTools, handleAnthropicToolCall } from "@memexai/sdk/adapters/anthropic"

const MEMEX_URL = process.env["MEMEX_URL"] ?? "http://localhost:8080"
const MEMEX_API_KEY = process.env["MEMEX_API_KEY"] ?? "dev-agent-key"
const MEMEX_USER_ID = process.env["MEMEX_USER_ID"] ?? "anthropic_service_demo_user"
const ANTHROPIC_API_KEY = process.env["ANTHROPIC_API_KEY"]
const ANTHROPIC_MODEL = process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6"

if (!ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is required. Add it to examples/anthropic-service/.env.")
}

const memex = new MemexAI({ url: MEMEX_URL, apiKey: MEMEX_API_KEY })
const memory = memex.forUser({ userId: MEMEX_USER_ID, actor: "anthropic-service-example" })
const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
const tools = createAnthropicTools(memory)

await runTurn("Remember that I prefer quiet neighborhoods near parks.", ["memory_remember"])
await runTurn("What kind of neighborhood do I prefer? Answer from memory.", ["memory_context"])
await learnFromToolResult()

async function runTurn(prompt: string, allowedToolNames: string[]) {
  const system = await memory.getSystemPrompt(
    [
      "You are a concise assistant with durable MemexAI memory.",
      "Use memory_remember for stable user facts and memory_context before memory-dependent answers.",
    ].join("\n"),
  )
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }]
  const activeTools = tools.filter((tool) => allowedToolNames.includes(tool.name))

  for (let step = 0; step < 5; step++) {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      tools: activeTools,
      messages,
    })

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason !== "tool_use") {
      const text = response.content.find((block) => block.type === "text")?.text ?? ""
      console.log(`\nUser: ${prompt}`)
      console.log(`Assistant: ${text}`)
      return
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type !== "tool_use") continue
      const result = await handleAnthropicToolCall(block.name, block.input, memory, block.id)
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      })
    }

    messages.push({ role: "user", content: toolResults })
  }

  throw new Error("Anthropic example did not finish after 5 tool-call steps")
}

async function learnFromToolResult() {
  const insight = [
    "run_sql permanent failure:",
    "ILIKE is not supported in this SQL dialect; use LOWER(column) LIKE LOWER(pattern).",
  ].join(" ")
  const result = await memory.remember({ text: insight, toolCallId: "anthropic_example_run_sql_extraction" })

  console.log("\nExtraction scenario")
  console.log(`Learned: ${insight}`)
  console.log(`Writes: ${result.writes.map((write) => write.path).join(", ") || "none"}`)
}
