import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { openai, createOpenAI } from "@ai-sdk/openai"
import { generateText, stepCountIs } from "ai"
import { createMemex } from "@memexai/core"
import { MemexAI } from "@memexai/sdk"
import { pathToFileURL } from "node:url"

type Env = Record<string, string | undefined>
type Logger = (message: string) => void
type GenerateText = typeof generateText
type OpenAIModelFactory = typeof openai
type GoogleModelFactory = ReturnType<typeof createGoogleGenerativeAI>

export type CliOptions = {
  smoke: boolean
  direct: boolean
  prompt?: string
}

export function parseCliArgs(argv: string[]): CliOptions {
  const smoke = argv.includes("--smoke")
  const direct = argv.includes("--direct")
  const prompt = argv.filter((arg) => arg !== "--smoke" && arg !== "--direct").join(" ").trim()
  return { smoke, direct, prompt: prompt || undefined }
}

export function createDirectMemory(env: Env, model?: unknown) {
  const databaseUrl = requireEnv(env, "DATABASE_URL")
  const userId = env.MEMEX_DEMO_USER_ID || "demo_user"
  const memex = model ? createMemex({ databaseUrl, model }) : createMemex(databaseUrl)
  return { memex, userId, user: memex.forUser({ userId, actor: "demo-agent" }) }
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
  retryDelayMs?: number
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

  await retryUntilReady(() => memory.listFiles(), input.retryDelayMs ?? 500)
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
  googleModelFactory?: GoogleModelFactory
}) {
  const env = input.env ?? process.env
  const log = input.log ?? console.log
  const modelConfig = createModelConfig(env, input.modelFactory, input.googleModelFactory)

  const { userId, memory } = createDemoMemory(env, input.fetchImpl)
  const promptBlock = await memory.getPromptBlock()
  const runGenerateText = input.generate ?? generateText

  const result = await runGenerateText({
    model: modelConfig.model,
    system: [
      "You are a concise MemexAI demo agent.",
      "Use MemexAI memory tools whenever the user asks you to remember or retrieve durable memory.",
      "",
      promptBlock,
    ].join("\n"),
    prompt: input.prompt,
    tools: memory.createAgenticToolset(),
    stopWhen: stepCountIs(5),
  })

  log(result.text)
  log("")
  log(`Model: ${modelConfig.provider}/${modelConfig.modelName}`)
  log(`Demo user: ${userId}`)
  return result
}

export async function runSmokeDirect(input: {
  env?: Env
  log?: Logger
  memexOverride?: ReturnType<typeof createDirectMemory>
} = {}) {
  const env = input.env ?? process.env
  const log = input.log ?? console.log
  const { memex, userId, user } = input.memexOverride ?? createDirectMemory(env)

  await memex.migrate()

  const content = [
    "# Demo Agent (direct)",
    "",
    `- User id: ${userId}`,
    `- Smoke check: ${new Date().toISOString()}`,
    "- This file was written via @memexai/core (direct Postgres, no HTTP service).",
  ].join("\n")

  await user.write("user/demo-agent.md", content, "Demo agent smoke check (direct mode)")
  const file = await user.read("user/demo-agent.md")

  log("MemexAI direct smoke check passed.")
  log(`User: ${userId}`)
  log(`Read: ${file.path} (${file.content.length} chars)`)

  await memex.end()
  return file
}

export async function runLiveAgentDirect(input: {
  prompt: string
  env?: Env
  log?: Logger
  generate?: GenerateText
  googleModelFactory?: GoogleModelFactory
  modelFactory?: OpenAIModelFactory
  memexOverride?: ReturnType<typeof createDirectMemory>
}) {
  const env = input.env ?? process.env
  const log = input.log ?? console.log
  const modelConfig = createModelConfig(env, input.modelFactory, input.googleModelFactory)

  const { memex, userId, user } = input.memexOverride ?? createDirectMemory(env, modelConfig.model)
  await memex.migrate()
  const promptBlock = await user.getPromptBlock()
  const runGenerateText = input.generate ?? generateText

  const result = await runGenerateText({
    model: modelConfig.model,
    system: [
      "You are a concise MemexAI demo agent (direct Postgres mode).",
      "Use MemexAI memory tools whenever the user asks you to remember or retrieve durable memory.",
      "",
      promptBlock,
    ].join("\n"),
    prompt: input.prompt,
    tools: user.createAgenticToolset(),
    stopWhen: stepCountIs(5),
  })

  log(result.text)
  log("")
  log(`Model: ${modelConfig.provider}/${modelConfig.modelName}`)
  log(`Demo user: ${userId}`)

  await memex.end()
  return result
}

export async function main(argv = process.argv.slice(2), env: Env = process.env) {
  const options = parseCliArgs(argv)

  if (options.smoke) {
    if (options.direct) {
      await runSmokeDirect({ env })
    } else {
      await runSmoke({ env })
    }
    return
  }

  if (!options.prompt) {
    throw new Error('Usage: bun run demo:agent -- "Remember that I prefer quiet projects near good schools"\n       Add --direct to use @memexai/core (requires DATABASE_URL)')
  }

  if (options.direct) {
    await runLiveAgentDirect({ prompt: options.prompt, env })
  } else {
    await runLiveAgent({ prompt: options.prompt, env })
  }
}

function requireEnv(env: Env, key: string) {
  const value = env[key]
  if (!value) throw new Error(`${key} is required`)
  return value
}

function createModelConfig(env: Env, openaiFactory?: OpenAIModelFactory, googleFactory?: GoogleModelFactory) {
  const geminiApiKey = env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY
  if (geminiApiKey) {
    const modelName = env.GEMINI_MODEL || env.GOOGLE_GENERATIVE_AI_MODEL || "gemini-2.5-flash"
    const google = googleFactory ?? createGoogleGenerativeAI({ apiKey: geminiApiKey })
    return { provider: "google", modelName, model: google(modelName) }
  }

  if (env.OLLAMA_MODEL) {
    const baseURL = (env.OLLAMA_BASE_URL ?? "http://localhost:11434") + "/v1"
    const modelName = env.OLLAMA_MODEL
    return { provider: "ollama", modelName, model: createOpenAI({ baseURL, apiKey: "ollama" })(modelName) }
  }

  const modelName = env.OPENAI_MODEL || "gpt-4.1-mini"
  requireEnv(env, "OPENAI_API_KEY")
  const makeOpenAIModel = openaiFactory ?? openai
  return { provider: "openai", modelName, model: makeOpenAIModel(modelName) }
}

async function retryUntilReady<T>(fn: () => Promise<T>, delayMs: number): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === 20) break
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
