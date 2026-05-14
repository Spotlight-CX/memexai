import { MemexAI } from "../packages/sdk/dist/index.js"

const url = process.env.MEMEX_URL ?? "http://localhost:8080"
const apiKey = process.env.MEMEX_API_KEY ?? "dev-agent-key"
const userId = process.env.MEMEX_TEST_USER_ID ?? `tmp_container_${Date.now()}`

console.log("== MemexAI container/HTTP test ==")
console.log(`MEMEX_URL=${url}`)
console.log(`userId=${userId}`)
console.log("Note: LLM config for this mode belongs to the running service/container env, not this SDK script.")

const memex = new MemexAI({ url, apiKey })
const memory = memex.forUser({ userId, actor: "tmp-container-http" })

await waitForService(memory)
await runWithoutLlm()
await runWithServiceLlmIfConfigured()

async function runWithoutLlm() {
  console.log("\n-- without client LLM: raw write + service BM25 search fallback --")

  await memory.writeFile({
    path: "user/tmp-container-profile.md",
    content: [
      "# Temporary HTTP Profile",
      "",
      "- Prefers quiet neighborhoods near good schools.",
      "- Likes parks, short commutes, and low traffic.",
    ].join("\n"),
    reason: "temporary HTTP BM25 seed",
  })

  console.log("agentic toolset:", Object.keys(memory.createAgenticToolset()))
  console.log("raw toolset:", Object.keys(memory.createRawToolset()))

  const result = await memory.search({ query: "quiet neighborhoods schools", limit: 5 })
  console.dir(result, { depth: null })
}

async function runWithServiceLlmIfConfigured() {
  console.log("\n-- with service LLM if configured: memorize + agentic search --")
  try {
    const memorize = await memory.memorize({
      text: "Remember that this temporary HTTP test user likes calm residential areas, school access, and homes near parks.",
      maxWrites: 3,
    })
    console.log("memorize result:")
    console.dir(memorize, { depth: null })
  } catch (error) {
    if (error?.code === "MODEL_NOT_CONFIGURED") {
      console.log("Skipped memorize: service returned MODEL_NOT_CONFIGURED.")
      console.log("Start the service/container with GEMINI_API_KEY/GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY to test agentic HTTP mode.")
    } else {
      throw error
    }
  }

  const result = await memory.search({
    query: "What residential location preferences does this user have?",
    maxReads: 3,
    maxChars: 4000,
  })
  console.log("search result:")
  console.dir(result, { depth: null })
}

async function waitForService(memoryClient) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await memoryClient.listFiles()
      return
    } catch (error) {
      if (attempt === 20) throw error
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}
