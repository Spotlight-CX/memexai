import { openai } from "@ai-sdk/openai"
import { generateText, stepCountIs } from "ai"
import { MemexAI } from "@memexai/sdk"
import { createVercelAITools } from "@memexai/sdk/adapters/vercel-ai"
import { pathToFileURL } from "node:url"

type Env = Record<string, string | undefined>
type Logger = (message: string) => void
type GenerateText = typeof generateText
type OpenAIModelFactory = typeof openai

export type CliOptions = {
  smoke: boolean
  prompt?: string
}

export function parseCliArgs(argv: string[]): CliOptions {
  const smoke = argv.includes("--smoke")
  const prompt = argv.filter((arg) => arg !== "--smoke").join(" ").trim()
  return { smoke, prompt: prompt || undefined }
}

export function createDemoMemory(env: Env, fetchImpl?: typeof fetch) {
  const url = requireEnv(env, "MEMEX_URL")
  const apiKey = requireEnv(env, "MEMEX_API_KEY")
  const userId = env.MEMEX_DEMO_USER_ID || "demo_user"

  const memex = new MemexAI({
    url,
    apiKey,
    fetch: fetchImpl,
  })

  return {
    url,
    userId,
    memory: memex.forUser({ userId, actor: "demo-agent" }),
  }
}

export async function runSmoke(input: {
  env?: Env
  fetchImpl?: typeof fetch
  log?: Logger
} = {}) {
  const env = input.env ?? process.env
  const log = input.log ?? console.log
  const { url, userId, memory } = createDemoMemory(env, input.fetchImpl)
  const content = [
    "# Demo Agent",
    "",
    `- User id: ${userId}`,
    `- Smoke check: ${new Date().toISOString()}`,
    "- This file was written through the MemexAI TypeScript SDK.",
  ].join("\n")

  await memory.listFiles({ prefix: "user/" })
  await memory.writeFile({
    path: "user/demo-agent.md",
    content,
    reason: "Demo agent smoke check",
    toolCallId: "demo-smoke-write",
  })
  const file = await memory.readFile({ path: "user/demo-agent.md" })

  log("MemexAI demo smoke check passed.")
  log(`User: ${userId}`)
  log(`Read: ${file.path} (${file.content.length} chars)`)
  log(`Admin: ${url.replace(/\/+$/, "")}/admin`)

  return file
}

export async function runLiveAgent(input: {
  prompt: string
  env?: Env
  fetchImpl?: typeof fetch
  log?: Logger
  generate?: GenerateText
  modelFactory?: OpenAIModelFactory
}) {
  const env = input.env ?? process.env
  const log = input.log ?? console.log
  const modelName = env.OPENAI_MODEL || "gpt-4.1-mini"
  requireEnv(env, "OPENAI_API_KEY")

  const { userId, memory } = createDemoMemory(env, input.fetchImpl)
  const promptBlock = await memory.getPromptBlock()
  const runGenerateText = input.generate ?? generateText
  const makeModel = input.modelFactory ?? openai

  const result = await runGenerateText({
    model: makeModel(modelName),
    system: [
      "You are a concise MemexAI demo agent.",
      "Use MemexAI memory tools whenever the user asks you to remember, retrieve, update, or inspect durable memory.",
      "Write user-specific durable notes under user/**. Do not write shared/**.",
      "",
      promptBlock,
    ].join("\n"),
    prompt: input.prompt,
    tools: createVercelAITools(memory),
    stopWhen: stepCountIs(5),
  })

  log(result.text)
  log("")
  log(`Demo user: ${userId}`)
  return result
}

export async function main(argv = process.argv.slice(2), env: Env = process.env) {
  const options = parseCliArgs(argv)

  if (options.smoke) {
    await runSmoke({ env })
    return
  }

  if (!options.prompt) {
    throw new Error('Usage: bun run demo:agent -- "Remember that I prefer quiet projects near good schools"')
  }

  await runLiveAgent({ prompt: options.prompt, env })
}

function requireEnv(env: Env, key: string) {
  const value = env[key]
  if (!value) throw new Error(`${key} is required`)
  return value
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
