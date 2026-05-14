import { describe, expect, test, vi } from "vitest"
import { loadConfig } from "../src/config"
import { createServiceModel } from "../src/model"

function config(env: Record<string, string>) {
  return loadConfig({
    DATABASE_URL: "postgresql://localhost/memexai",
    MEMEX_API_KEY: "agent-key",
    ...env,
  })
}

describe("createServiceModel", () => {
  test("returns undefined when no model env is configured", async () => {
    await expect(createServiceModel(config({}))).resolves.toBeUndefined()
  })

  test("chooses Gemini when Gemini env is present", async () => {
    const model = { id: "gemini" }
    const googleModel = vi.fn(() => model)
    const googleFactory = vi.fn(() => googleModel)

    const result = await createServiceModel(config({ GEMINI_API_KEY: "gemini-key" }), {
      google: googleFactory as never,
    })

    expect(result).toMatchObject({ provider: "google", modelName: "gemini-2.5-flash", model })
    expect(googleFactory).toHaveBeenCalledWith({ apiKey: "gemini-key" })
    expect(googleModel).toHaveBeenCalledWith("gemini-2.5-flash")
  })

  test("chooses OpenAI when OpenAI env is present", async () => {
    const model = { id: "openai" }
    const openaiFactory = vi.fn(() => model)

    const result = await createServiceModel(config({ OPENAI_API_KEY: "openai-key", OPENAI_MODEL: "gpt-test" }), {
      openai: openaiFactory as never,
    })

    expect(result).toMatchObject({ provider: "openai", modelName: "gpt-test", model })
    expect(openaiFactory).toHaveBeenCalledWith("gpt-test")
  })

  test("honors explicit provider", async () => {
    const model = { id: "openai" }
    const openaiFactory = vi.fn(() => model)

    const result = await createServiceModel(config({
      MEMEX_LLM_PROVIDER: "openai",
      GEMINI_API_KEY: "gemini-key",
      OPENAI_API_KEY: "openai-key",
    }), {
      openai: openaiFactory as never,
    })

    expect(result?.provider).toBe("openai")
  })
})
