import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createMemex } from "@memexai/core"
import { createVercelAITools } from "@memexai/core/adapters/vercel-ai"

const DATABASE_URL = process.env["DATABASE_URL"]
if (!DATABASE_URL) throw new Error("DATABASE_URL is required")

const GEMINI_API_KEY = process.env["GEMINI_API_KEY"]
if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required")

const USER_ID = process.env["USER_ID"] ?? "demo_user"
const prompt = process.argv[2] ?? "Remember that I prefer quiet neighborhoods near good schools."

const memex = createMemex(DATABASE_URL)
await memex.migrate()

const user = memex.forUser({ userId: USER_ID, actor: "assistant" })
const promptBlock = await user.getPromptBlock()
const tools = createVercelAITools(user)

const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY })

const result = await generateText({
  model: google("gemini-2.5-flash"),
  system: [
    "You are a helpful assistant with durable memory.",
    "Use memory tools to remember stable facts the user shares.",
    "Write user-specific notes under user/**.",
    "",
    promptBlock,
  ].join("\n"),
  prompt,
  tools,
  stopWhen: stepCountIs(5),
})

console.log("\nAssistant:", result.text)
console.log(`\nMemory written. Run: npx memex-admin --database-url ${DATABASE_URL}`)

await memex.end()
