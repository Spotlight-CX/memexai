import OpenAI from "openai"
import type {
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions"
import { MemexAI } from "@memexai/sdk"
import { createOpenAITools, type OpenAIToolDefinition } from "@memexai/sdk/adapters/openai"

const MEMEX_URL = process.env["MEMEX_URL"] ?? "http://localhost:8080"
const MEMEX_API_KEY = process.env["MEMEX_API_KEY"] ?? "dev-agent-key"
// Today this value identifies the agent/user memory namespace in MemexAI; the term may change later.
const MEMEX_USER_ID = process.env["MEMEX_USER_ID"] ?? "openai-sdk-service-demo-user"
const GEMINI_API_KEY = process.env["GEMINI_API_KEY"]
const OPENAI_BASE_URL = process.env["OPENAI_BASE_URL"] ?? "https://generativelanguage.googleapis.com/v1beta/openai/"
const OPENAI_MODEL = process.env["OPENAI_MODEL"] ?? "gemini-2.5-flash"

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is required. Add it to examples/openai-sdk-service/.env.")
}

const rememberedValue = process.argv.slice(2).join(" ").trim() || "I prefer 2BHK apartments."
const recallQuestion = `What apartment size do I prefer? Answer from memory only.`

const memex = new MemexAI({ url: MEMEX_URL, apiKey: MEMEX_API_KEY })
const memory = memex.forUser({ userId: MEMEX_USER_ID, actor: "openai-sdk-service-example" })
const openaiTools = createOpenAITools(memory)
const tools: ChatCompletionFunctionTool[] = toChatCompletionTools(
  openaiTools.definitions.filter((tool) => tool.name === "memory_memorize" || tool.name === "memory_search"),
)

const openai = new OpenAI({
  apiKey: GEMINI_API_KEY,
  baseURL: OPENAI_BASE_URL,
})

console.log(`MemexAI service: ${MEMEX_URL}`)
console.log(`MemexAI user: ${MEMEX_USER_ID}`)
console.log(`Model: ${OPENAI_MODEL}`)

await runRememberTurn(rememberedValue)
await runRecallTurn(recallQuestion)

async function runRememberTurn(fact: string) {
  const system = await memory.getSystemPrompt([
    "You are a helpful assistant with durable memory.",
    "When the user asks you to remember a stable preference, call memory_memorize before answering.",
    "Keep the final answer short and confirm what was remembered.",
  ].join("\n"))

  // This example asks the model to memorize during the user turn. Many production agents
  // also run a post-turn memorize pass after the final assistant response; when doing that,
  // send only compact new facts to memory_memorize to reduce duplicate notes.
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: `Remember this durable preference: ${fact}` },
  ]

  const answer = await completeWithMemoryTools(messages, ["memory_memorize"])
  console.log("\nTurn 1 - remember")
  console.log(`User: Remember this durable preference: ${fact}`)
  console.log(`Assistant: ${answer}`)
}

async function runRecallTurn(question: string) {
  const system = await memory.getSystemPrompt([
    "You are a helpful assistant with durable memory.",
    "Use memory_search before answering questions that may depend on prior user memory.",
    "If memory contains the answer, answer directly and cite the remembered fact in plain language.",
  ].join("\n"))

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: question },
  ]

  const answer = await completeWithMemoryTools(messages, ["memory_search"])
  console.log("\nTurn 2 - recall")
  console.log(`User: ${question}`)
  console.log(`Assistant: ${answer}`)
}

async function completeWithMemoryTools(
  messages: ChatCompletionMessageParam[],
  allowedToolNames: string[],
): Promise<string> {
  const allowedTools = tools.filter((tool) => allowedToolNames.includes(tool.function.name))

  for (let step = 0; step < 6; step++) {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      tools: allowedTools,
      tool_choice: "auto",
    })

    const choice = completion.choices[0]
    if (!choice) throw new Error("Model returned no choices")

    const assistantMessage = withStableToolCallIds(choice.message)
    messages.push(assistantMessage)

    const toolCalls = assistantMessage.tool_calls
    if (!toolCalls?.length) {
      return contentToString(assistantMessage.content)
    }

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "function") continue

      const result = await openaiTools.execute({
        name: toolCall.function.name,
        arguments: toolCall.function.arguments,
        toolCallId: toolCall.id,
      })

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }
  }

  throw new Error("Model did not finish after 6 tool-call steps")
}

function toChatCompletionTools(definitions: OpenAIToolDefinition[]): ChatCompletionFunctionTool[] {
  return definitions.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

function withStableToolCallIds(message: OpenAI.Chat.ChatCompletionMessage): OpenAI.Chat.ChatCompletionMessage {
  if (!message.tool_calls?.length) return message

  return {
    ...message,
    tool_calls: message.tool_calls.map((toolCall, index) => {
      if (toolCall.id) return toolCall
      return {
        ...toolCall,
        id: `call_memex_${Date.now()}_${index}`,
      } satisfies ChatCompletionMessageToolCall
    }),
  }
}

function contentToString(content: OpenAI.Chat.ChatCompletionMessage["content"]): string {
  return content ?? ""
}
