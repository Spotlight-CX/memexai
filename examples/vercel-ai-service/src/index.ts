import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, stepCountIs } from "ai"
import { config as loadEnv } from "dotenv"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { MemexAI } from "@memexai/sdk"

const here = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: resolve(here, "../../../.env"), quiet: true })
loadEnv({ path: resolve(here, "../.env"), override: true, quiet: true })

const MEMEX_URL = process.env["MEMEX_URL"] ?? "http://localhost:8080"
const MEMEX_API_KEY = process.env["MEMEX_API_KEY"] ?? "dev-agent-key"

// Today this value identifies the agent/user memory namespace in MemexAI.
// The product term may change later, so avoid treating "userId" as final naming.
const MEMEX_USER_ID = process.env["MEMEX_USER_ID"] ?? "example_vercel_ai_service_user"

const GEMINI_API_KEY = process.env["GEMINI_API_KEY"]
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is required. Add it to the repo .env or export it before running this example.")
}

const command = process.argv[2] ?? "remember"
const preferenceArgs = process.argv.slice(3).filter((arg, index) => !(index === 0 && arg === "--"))
const preference =
  preferenceArgs.join(" ").trim() ||
  "I prefer ceramic pour-over coffee with oat milk before writing code."

const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY })
const memex = new MemexAI({ url: MEMEX_URL, apiKey: MEMEX_API_KEY })
const memory = memex.forUser({ userId: MEMEX_USER_ID, actor: "vercel-ai-service-example" })

const baseSystemPrompt = [
  "You are a concise CLI assistant with durable MemexAI memory.",
  "Use memory tools for stable user preferences and retrieve memory before answering recall questions.",
  "When a memory tool returns useful information, answer plainly and include the remembered value.",
].join("\n")

switch (command) {
  case "remember":
    await rememberPreference(preference)
    break
  case "recall":
    await recallPreference()
    break
  case "learn-tool-result":
    await learnFromToolResult()
    break
  default:
    printUsageAndExit()
}

async function rememberPreference(text: string) {
  const system = await memory.getSystemPrompt(baseSystemPrompt)

  // In a chat app, this is often a post-turn memorize pass after responding to the user.
  // The CLI makes that pass explicit so the durable-write behavior is easy to inspect.
  const result = await generateText({
    model: google("gemini-2.5-flash"),
    system,
    prompt: [
      "Remember this durable user preference using MemexAI.",
      "After the tool call succeeds, briefly confirm the exact preference in one sentence.",
      "",
      text,
    ].join("\n"),
    tools: memory.createMemorySubagentToolset(),
    prepareStep: ({ stepNumber }) =>
      stepNumber === 0
        ? {
            activeTools: ["memory_remember"],
            toolChoice: { type: "tool", toolName: "memory_remember" },
          }
        : { activeTools: [] },
    stopWhen: stepCountIs(3),
  })

  printResult("remember", result.text, toolNames(result))
}

async function recallPreference() {
  const system = await memory.getSystemPrompt(baseSystemPrompt)

  const result = await generateText({
    model: google("gemini-2.5-flash"),
    system,
    prompt: "Search MemexAI memory and tell me my coffee preference. Include the exact preference if it is found.",
    tools: memory.createMemorySubagentToolset(),
    prepareStep: ({ stepNumber }) =>
      stepNumber === 0
        ? {
            activeTools: ["memory_context"],
            toolChoice: { type: "tool", toolName: "memory_context" },
          }
        : { activeTools: [] },
    stopWhen: stepCountIs(3),
  })

  printResult("recall", result.text, toolNames(result))
}

async function learnFromToolResult() {
  const toolResult = {
    toolName: "run_sql",
    ok: false,
    error: "ILIKE is not supported in this SQL dialect; use LOWER(column) LIKE LOWER(pattern).",
    permanent: true,
  }
  const insight = extractInsight(toolResult)
  if (!insight) {
    console.log("No durable insight found.")
    return
  }

  const result = await memory.remember({
    text: insight,
    toolCallId: "example_tool_result_run_sql",
  })

  console.log("command: learn-tool-result")
  console.log(`memex_url: ${MEMEX_URL}`)
  console.log(`memex_user_id: ${MEMEX_USER_ID}`)
  console.log(`insight: ${insight}`)
  console.log(`writes: ${result.writes.map((write) => write.path).join(", ") || "none"}`)
  console.log("")
  console.log([
    "In a real Vercel AI SDK loop, inspect result.steps after generateText/streamText.",
    "Filter step.toolResults for permanent, reusable failures, extract a compact fact,",
    "then call memory.remember({ text }) from your application code.",
  ].join("\n"))
}

function extractInsight(result: { toolName: string; ok: boolean; error?: string; permanent?: boolean }) {
  if (result.ok || !result.permanent || !result.error) return null
  return `${result.toolName} permanent failure: ${result.error}`
}

function printResult(commandName: string, text: string, tools: string[]) {
  console.log(`command: ${commandName}`)
  console.log(`memex_url: ${MEMEX_URL}`)
  console.log(`memex_user_id: ${MEMEX_USER_ID}`)
  console.log(`tools: ${tools.length > 0 ? tools.join(", ") : "none"}`)
  console.log("")
  console.log(text.trim())
}

function toolNames(result: { steps: Array<{ toolCalls: Array<{ toolName: string }> }> }) {
  return result.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName))
}

function printUsageAndExit(): never {
  console.error("Usage: bun run remember [preference text]")
  console.error("       bun run recall")
  console.error("       bun run learn-tool-result")
  process.exit(1)
}
