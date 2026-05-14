import { createMemex } from "../packages/core/dist/index.js"

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://memexai:memexai@localhost:5433/memexai"
const userId = process.env.MEMEX_TEST_USER_ID ?? `tmp_containerless_${Date.now()}`

console.log("== MemexAI containerless/direct test ==")
console.log(`DATABASE_URL=${databaseUrl}`)
console.log(`userId=${userId}`)

await runWithoutLlm()
await runWithLlmIfConfigured()

async function runWithoutLlm() {
  console.log("\n-- without LLM: raw write + BM25 search fallback --")
  const memex = createMemex(databaseUrl)
  await memex.migrate()
  const memory = memex.forUser({ userId, actor: "tmp-containerless-no-llm" })

  await memory.write(
    "user/tmp-containerless-profile.md",
    [
      "# Temporary Profile",
      "",
      "- Prefers quiet neighborhoods near good schools.",
      "- Budget notes mention parks and low traffic.",
    ].join("\n"),
    "temporary containerless BM25 seed",
  )

  console.log("agentic toolset:", Object.keys(memory.createAgenticToolset()))
  console.log("raw toolset:", Object.keys(memory.createRawToolset()))

  const result = await memory.search("quiet neighborhoods schools", { limit: 5 })
  console.dir(result, { depth: null })

  await memex.end()
}

async function runWithLlmIfConfigured() {
  console.log("\n-- with LLM: memorize + agentic search --")
  const model = await createModelFromEnv()
  if (!model) {
    console.log("Skipped: set GEMINI_API_KEY/GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY to enable direct-mode LLM.")
    return
  }

  const memex = createMemex({ databaseUrl, model })
  await memex.migrate()
  const memory = memex.forUser({ userId, actor: "tmp-containerless-llm" })

  const memorize = await memory.memorize(
    "Remember that this temporary test user likes calm residential areas, short school commutes, and homes near parks.",
    { maxWrites: 3 },
  )
  console.log("memorize result:")
  console.dir(memorize, { depth: null })

  const result = await memory.search("What residential location preferences does this user have?", {
    maxReads: 3,
    maxChars: 4000,
  })
  console.log("agentic search result:")
  console.dir(result, { depth: null })

  await memex.end()
}

async function createModelFromEnv() {
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (geminiKey) {
    const { createGoogleGenerativeAI } = await import("../apps/demo-agent/node_modules/@ai-sdk/google/dist/index.mjs")
    const modelName = process.env.GEMINI_MODEL ?? process.env.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.5-flash"
    console.log(`Using Gemini model: ${modelName}`)
    return createGoogleGenerativeAI({ apiKey: geminiKey })(modelName)
  }

  if (process.env.OPENAI_API_KEY) {
    const { openai } = await import("../apps/demo-agent/node_modules/@ai-sdk/openai/dist/index.mjs")
    const modelName = process.env.OPENAI_MODEL ?? "gpt-4.1-mini"
    console.log(`Using OpenAI model: ${modelName}`)
    return openai(modelName)
  }

  return undefined
}
