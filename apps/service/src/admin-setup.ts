import { generateText } from "ai"
import { z } from "zod"
import { HttpError } from "./errors"

export type SetupFile = {
  path: string
  content: string
  purpose: string
  memorySchemaRole: string
}

export type SetupExample = {
  userMessage: string
  shouldStore: boolean
  reason: string
  targetFile: string | null
  memoryLines: string[]
}

export type SetupGeneration = {
  files: SetupFile[]
  explanation: {
    summary: string
    schemaGuidance: string
    examples: SetupExample[]
    sharedMemoryIdeas: string[]
    rawToolNote: string
  }
}

const setupGenerationSchema = z.object({
  files: z.array(z.object({
    path: z.string().min(1),
    content: z.string().min(1),
    purpose: z.string().min(1),
    memorySchemaRole: z.string().min(1),
  })).min(3),
  explanation: z.object({
    summary: z.string().min(1),
    schemaGuidance: z.string().min(1),
    examples: z.array(z.object({
      userMessage: z.string().min(1),
      shouldStore: z.boolean(),
      reason: z.string().min(1),
      targetFile: z.string().nullable(),
      memoryLines: z.array(z.string()),
    })).min(2),
    sharedMemoryIdeas: z.array(z.string().min(1)).min(2),
    rawToolNote: z.string().min(1),
  }),
})

const USER_INFO_CATEGORY_LABELS: Record<string, string> = {
  "preferences": "Stated preferences and tastes",
  "constraints": "Hard constraints and disallowed choices",
  "goals": "Goals and active intentions",
  "history": "Past activity and user history",
  "context": "Personal context such as lifestyle, household, work, or routines",
}

const STABILITY_LABELS: Record<string, string> = {
  "volatile": "Changes often; agents should avoid over-storing and should treat older facts as easy to supersede.",
  "evolving": "Mostly stable but evolves gradually; agents should patch facts when users correct or refine them.",
  "static": "Rarely changes after onboarding; agents can rely on stable profile files and explicit corrections.",
}

export async function handleSetupGenerate(
  model: unknown,
  input: {
    productDescription: string
    domain: string
    userInfoCategories: string[]
    stability?: string
    extra?: string
  },
  generate = generateText,
): Promise<SetupGeneration> {
  if (!model) {
    throw new HttpError(
      503,
      "MODEL_NOT_CONFIGURED",
      "Setup generation requires a configured LLM. Set GEMINI_API_KEY, Vertex AI env vars, OPENAI_API_KEY, or OLLAMA_MODEL in your environment.",
    )
  }

  const result = await generate({
    model: model as never,
    system: [
      "You are MemexAI's admin onboarding designer.",
      "Generate the initial shared memory files for an AI product and explain the proposed memory schema.",
      "MemexAI stores memory as inspectable Markdown-like files in Postgres.",
      "`shared/` files are read-only guidance for all agents. `user/` files are per-user writable memory created by agents later.",
      "",
      "Return JSON only. Do not wrap it in Markdown.",
      "",
      "JSON shape:",
      "{",
      '  "files": [',
      '    { "path": "shared/index.md", "content": "...", "purpose": "...", "memorySchemaRole": "..." }',
      "  ],",
      '  "explanation": {',
      '    "summary": "...",',
      '    "schemaGuidance": "...",',
      '    "examples": [',
      '      { "userMessage": "...", "shouldStore": true, "reason": "...", "targetFile": "user/profile.md", "memoryLines": ["- ..."] }',
      "    ],",
      '    "sharedMemoryIdeas": ["..."],',
      '    "rawToolNote": "..."',
      "  }",
      "}",
      "",
      "File requirements:",
      "- Include exactly these shared files unless the product strongly needs one extra shared file: shared/index.md, shared/user-memory.md, shared/domain.md.",
      "- shared/index.md must be a concise map of shared files and spaces.",
      "- shared/user-memory.md must tell agents what to remember, what not to remember, how to organize user files, and how to handle corrections.",
      "- shared/domain.md must encode domain-specific memory categories, examples, and product-specific judgment.",
      "- File contents should be useful operational instructions, not marketing copy.",
      "- Use Markdown headings and bullets.",
      "",
      "Example requirements:",
      "- Include at least one example that should be stored and at least one that should not be stored.",
      "- Stored examples must include concrete memoryLines showing what an agent might write.",
      "- targetFile must use virtual paths like user/index.md, user/profile.md, or user/preferences.md. Use null when shouldStore is false.",
      "",
      "Tone:",
      "- Be precise and practical.",
      "- Explain why the schema fits this product.",
      "- Do not claim raw transcripts are stored by default.",
    ].join("\n"),
    prompt: buildSetupPrompt(input),
  })

  const parsed = parseJsonObject(result.text)
  const generation = setupGenerationSchema.parse(parsed)
  return normalizeGeneration(generation)
}

function buildSetupPrompt(input: {
  productDescription: string
  domain: string
  userInfoCategories: string[]
  stability?: string
  extra?: string
}) {
  const categoryLines = input.userInfoCategories
    .map((cat) => `- ${USER_INFO_CATEGORY_LABELS[cat] ?? cat}`)
    .join("\n")

  return [
    `Product description: ${input.productDescription}`,
    `Domain: ${input.domain}`,
    "",
    "User information categories selected by the admin:",
    categoryLines || "- Not specified",
    "",
    `Stability: ${STABILITY_LABELS[input.stability ?? ""] ?? "Not specified"}`,
    "",
    "Additional admin guidance:",
    input.extra?.trim() || "None",
    "",
    "Generate a MemexAI shared memory schema for this product.",
  ].join("\n")
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  try {
    return JSON.parse(withoutFence)
  } catch {
    const start = withoutFence.indexOf("{")
    const end = withoutFence.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) throw new Error("Setup generation returned invalid JSON")
    return JSON.parse(withoutFence.slice(start, end + 1))
  }
}

function normalizeGeneration(generation: SetupGeneration): SetupGeneration {
  const files = generation.files.map((file) => {
    if (!file.path.startsWith("shared/") || file.path.includes("..")) {
      throw new Error(`Invalid generated setup path: ${file.path}`)
    }
    return {
      ...file,
      path: file.path.replace(/^\/+/, ""),
      content: file.content.trimEnd() + "\n",
    }
  })

  const required = ["shared/index.md", "shared/user-memory.md", "shared/domain.md"]
  for (const path of required) {
    if (!files.some((file) => file.path === path)) {
      throw new Error(`Setup generation did not include ${path}`)
    }
  }

  return { ...generation, files }
}
