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
    memorableExample?: string
    neverStore?: string
    forgettingProblem?: string
    stability?: string
    includeTimestamps?: boolean
    extra?: string
    revisionInstruction?: string
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
      "- shared/domain.md must encode domain-specific memory categories, examples, and product-specific judgment. Ground it in the admin's concrete examples — use similar phrasing and categories they implied.",
      "- File contents should be useful operational instructions, not marketing copy.",
      "- Use Markdown headings and bullets.",
      "",
      "Timestamp convention:",
      "- If includeTimestamps is true: add a section in shared/user-memory.md titled '## Timestamp Convention' with this instruction:",
      "  'When writing a new fact, append the month it was learned: `- Prefers X [YYYY-MM]`. When patching a fact, update the timestamp to the current month.'",
      "  'This is the only signal for recency — MemexAI does not track which line was added when.'",
      "- If includeTimestamps is false: do not include timestamp instructions.",
      "",
      "Example requirements:",
      "- Include at least one example that should be stored and at least one that should not be stored.",
      "- Stored examples must include concrete memoryLines showing what an agent might write.",
      "- targetFile must use virtual paths like user/index.md, user/profile.md, or user/preferences.md. Use null when shouldStore is false.",
      "",
      "Tone:",
      "- Be precise and practical.",
      "- Use crisp admin-facing copy for quick scanning.",
      "- Do not write long rationale paragraphs.",
      "- Prefer operational labels over explanation.",
      "- Do not claim raw transcripts are stored by default.",
      "",
      "Brevity requirements for explanation:",
      "- summary: maximum 2 short sentences.",
      "- schemaGuidance: exactly 3 short bullet-like lines separated by newlines.",
      "- examples: exactly 3 examples when possible: one STORE, one IGNORE, one PATCH or correction example.",
      "- Each userMessage should be 120 characters or fewer.",
      "- Each reason should be 12 words or fewer.",
      "- Each memoryLines array should have at most 2 short lines.",
      "- sharedMemoryIdeas: at most 4 items, each 6 words or fewer.",
      "- rawToolNote: one short sentence.",
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
  memorableExample?: string
  neverStore?: string
  forgettingProblem?: string
  stability?: string
  includeTimestamps?: boolean
  extra?: string
  revisionInstruction?: string
}) {
  return [
    `Product description: ${input.productDescription}`,
    `Domain: ${input.domain}`,
    "",
    "Example of something a user might say that agents should DEFINITELY remember (provided by admin):",
    input.memorableExample?.trim() || "Not provided",
    "",
    "What agents should NEVER store (provided by admin):",
    input.neverStore?.trim() || "Not provided",
    "",
    "What goes wrong when agents forget user context (provided by admin):",
    input.forgettingProblem?.trim() || "Not provided",
    "",
    `Stability: ${STABILITY_LABELS[input.stability ?? ""] ?? "Not specified"}`,
    "",
    `Include timestamps: ${input.includeTimestamps === true ? "yes" : "no"}`,
    "",
    "Additional admin guidance:",
    input.extra?.trim() || "None",
    "",
    "Admin-requested revision to the draft:",
    input.revisionInstruction?.trim() || "None",
    "",
    "Generate a MemexAI shared memory schema for this product. Ground shared/domain.md in the admin's concrete examples above.",
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

  return {
    ...generation,
    files,
    explanation: {
      summary: clampWords(generation.explanation.summary, 38),
      schemaGuidance: splitGuidance(generation.explanation.schemaGuidance).slice(0, 3).join("\n"),
      examples: normalizeExamples(generation.explanation.examples),
      sharedMemoryIdeas: generation.explanation.sharedMemoryIdeas
        .map((idea) => clampWords(idea, 6))
        .filter(Boolean)
        .slice(0, 4),
      rawToolNote: clampWords(generation.explanation.rawToolNote, 22),
    },
  }
}

function clampWords(value: string, maxWords: number): string {
  const words = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean)
  if (words.length <= maxWords) return words.join(" ")
  return `${words.slice(0, maxWords).join(" ")}...`
}

function splitGuidance(value: string): string[] {
  const lines = value
    .split(/\n|•|-/)
    .map((line) => clampWords(line.replace(/^\s*\d+[\.)]\s*/, ""), 14))
    .filter(Boolean)

  return lines.length
    ? lines
    : [clampWords(value, 14)]
}

function normalizeExamples(examples: SetupExample[]): SetupExample[] {
  return examples.slice(0, 3).map((example) => ({
    userMessage: clampWords(example.userMessage, 18),
    shouldStore: example.shouldStore,
    reason: clampWords(example.reason, 12),
    targetFile: example.shouldStore ? example.targetFile : null,
    memoryLines: example.memoryLines
      .map((line) => clampWords(line.replace(/^-\s*/, ""), 12))
      .filter(Boolean)
      .slice(0, 2),
  }))
}
