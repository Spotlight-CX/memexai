import { MemexAI } from "@memexai/sdk"
import { pathToFileURL } from "node:url"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { readFileSync } from "node:fs"

type Env = Record<string, string | undefined>
type Logger = (message: string) => void
type Prompt = (question: string) => Promise<string>

export type InspectInput = {
  userId?: string
  path?: string
}

export function parseInspectArgs(argv: string[]): InspectInput {
  const input: InspectInput = {}

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--user" || arg === "--user-id") {
      input.userId = argv[index + 1]
      index += 1
      continue
    }

    if (arg === "--path") {
      input.path = argv[index + 1]
      index += 1
    }
  }

  return input
}

export async function inspectMemory(input: {
  argv?: string[]
  env?: Env
  fetchImpl?: typeof fetch
  prompt?: Prompt
  log?: Logger
} = {}) {
  const env = input.env ?? process.env
  const log = input.log ?? console.log
  const args = parseInspectArgs(input.argv ?? process.argv.slice(2))
  let prompts: { prompt: Prompt; close: () => void } | undefined
  const prompt = async (question: string) => {
    prompts ??= createPrompt(input.prompt)
    return prompts.prompt(question)
  }

  try {
    const userId = ((args.userId ?? (await prompt("User id [demo_user]: ")).trim()) || "demo_user").trim()
    const memex = new MemexAI({
      url: requireEnv(env, "MEMEX_URL"),
      apiKey: requireEnv(env, "MEMEX_API_KEY"),
      fetch: input.fetchImpl,
    })
    const memory = memex.forUser({ userId, actor: "inspect-cli" })
    const { files } = await memory.listFiles()

    log("")
    log(`User: ${userId}`)
    log("Files:")
    if (files.length === 0) {
      log("  No files found.")
    } else {
      for (const file of files) {
        log(`  ${file.path} (${file.size} bytes, updated ${file.updatedAt})`)
      }
    }

    if (args.path) {
      const file = await memory.readFile({ path: args.path })
      log("")
      log(`--- ${file.path} ---`)
      log(file.content)
      return { userId, files, file }
    }

    let lastFile
    while (true) {
      const selectedPath = (await prompt("\nPath to read [blank/q to exit]: ")).trim()
      if (!selectedPath || selectedPath.toLowerCase() === "q" || selectedPath.toLowerCase() === "quit") {
        return { userId, files, file: lastFile }
      }

      lastFile = await memory.readFile({ path: selectedPath })
      log("")
      log(`--- ${lastFile.path} ---`)
      log(lastFile.content)
    }
  } finally {
    prompts?.close()
  }
}

function requireEnv(env: Env, key: string) {
  const value = env[key]
  if (!value) throw new Error(`${key} is required`)
  return value
}

function createPrompt(injectedPrompt?: Prompt): { prompt: Prompt; close: () => void } {
  if (injectedPrompt) return { prompt: injectedPrompt, close: () => {} }

  if (!stdin.isTTY) {
    const answers = readFileSync(0, "utf8").split(/\r?\n/)
    return {
      prompt: async (question: string) => {
        stdout.write(question)
        return answers.shift() ?? ""
      },
      close: () => {},
    }
  }

  const rl = createInterface({ input: stdin, output: stdout })
  return {
    prompt: (question: string) => rl.question(question),
    close: () => rl.close(),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  inspectMemory().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
