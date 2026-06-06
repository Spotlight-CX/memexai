import { describe, expect, test, vi } from "vitest"
import { handleSetupGenerate } from "../src/admin-setup"

const validGeneration = {
  files: [
    {
      path: "shared/index.md",
      content: "# Memory System\n",
      purpose: "Maps shared memory files.",
      memorySchemaRole: "Tells agents where to find memory policy.",
    },
    {
      path: "shared/user-memory.md",
      content: "# User Memory Guide\n",
      purpose: "Defines what to remember.",
      memorySchemaRole: "Controls user file organization.",
    },
    {
      path: "shared/domain.md",
      content: "# Domain Context\n",
      purpose: "Captures domain-specific memory rules.",
      memorySchemaRole: "Adapts memory decisions to the product.",
    },
  ],
  explanation: {
    summary: "This schema stores durable preferences and constraints.",
    schemaGuidance: "Agents should use topic files under user/ and maintain user/index.md.",
    examples: [
      {
        userMessage: "Remember I prefer quiet neighborhoods near parks.",
        shouldStore: true,
        reason: "Stable preference.",
        targetFile: "user/preferences.md",
        memoryLines: ["- Prefers quiet neighborhoods near parks."],
      },
      {
        userMessage: "What is the weather today?",
        shouldStore: false,
        reason: "Transient lookup.",
        targetFile: null,
        memoryLines: [],
      },
    ],
    sharedMemoryIdeas: ["Add product policy.", "Add retention guidance."],
    rawToolNote: "Raw tools are for debugging and deterministic file control.",
  },
}

describe("handleSetupGenerate", () => {
  test("requires a configured model", async () => {
    await expect(handleSetupGenerate(undefined, {
      productDescription: "A shopping assistant",
      domain: "Shopping / Commerce",
      memorableExample: "I prefer window seats and boutique hotels",
    })).rejects.toMatchObject({ code: "MODEL_NOT_CONFIGURED" })
  })

  test("returns LLM generated files and explanations", async () => {
    const generate = vi.fn(async () => ({ text: JSON.stringify(validGeneration) }))

    const result = await handleSetupGenerate({ id: "model" }, {
      productDescription: "A shopping assistant",
      domain: "Shopping / Commerce",
      memorableExample: "I prefer window seats and boutique hotels",
      neverStore: "One-off price lookups and weather queries",
      forgettingProblem: "Recommending chain hotels to users who hate chains",
      stability: "evolving",
      includeTimestamps: true,
      extra: "Track fit and budget.",
      revisionInstruction: "Make budget a hard constraint.",
    }, generate as never)

    expect(result.files).toHaveLength(3)
    expect(result.files[0]).toMatchObject({
      path: "shared/index.md",
      purpose: "Maps shared memory files.",
    })
    expect(result.files[0].content.endsWith("\n")).toBe(true)
    expect(result.explanation.examples[0]).toMatchObject({
      shouldStore: true,
      targetFile: "user/preferences.md",
    })
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      model: { id: "model" },
      prompt: expect.stringContaining("Track fit and budget."),
    }))
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("Make budget a hard constraint."),
    }))
  })

  test("rejects generated files outside shared mount", async () => {
    const generate = vi.fn(async () => ({
      text: JSON.stringify({
        ...validGeneration,
        files: [
          { ...validGeneration.files[0], path: "user/index.md" },
          validGeneration.files[1],
          validGeneration.files[2],
        ],
      }),
    }))

    await expect(handleSetupGenerate({ id: "model" }, {
      productDescription: "A shopping assistant",
      domain: "Shopping / Commerce",
      memorableExample: "I prefer window seats and boutique hotels",
    }, generate as never)).rejects.toThrow(/Invalid generated setup path/)
  })
})
