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

  test("chooses Vertex when Vertex env is present", async () => {
    const model = { id: "vertex" }
    const vertexModel = vi.fn(() => model)
    const vertexFactory = vi.fn(() => vertexModel)

    const result = await createServiceModel(config({
      GOOGLE_VERTEX_PROJECT: "vertex-project",
      GOOGLE_APPLICATION_CREDENTIALS: "/run/secrets/google-vertex-sa.json",
    }), {
      vertex: vertexFactory as never,
    })

    expect(result).toMatchObject({ provider: "vertex", modelName: "gemini-2.5-flash", model })
    expect(vertexFactory).toHaveBeenCalledWith({
      project: "vertex-project",
      location: "us-central1",
      googleAuthOptions: { keyFilename: "/run/secrets/google-vertex-sa.json" },
    })
    expect(vertexModel).toHaveBeenCalledWith("gemini-2.5-flash")
  })

  test("honors Vertex model and location overrides", async () => {
    const vertexModel = vi.fn(() => ({ id: "vertex" }))
    const vertexFactory = vi.fn(() => vertexModel)

    const result = await createServiceModel(config({
      MEMEX_LLM_PROVIDER: "vertex",
      GOOGLE_VERTEX_PROJECT: "vertex-project",
      GOOGLE_VERTEX_LOCATION: "asia-south1",
      GOOGLE_VERTEX_MODEL: "gemini-test",
      GOOGLE_APPLICATION_CREDENTIALS: "/tmp/vertex-key.json",
    }), {
      vertex: vertexFactory as never,
    })

    expect(result?.modelName).toBe("gemini-test")
    expect(vertexFactory).toHaveBeenCalledWith({
      project: "vertex-project",
      location: "asia-south1",
      googleAuthOptions: { keyFilename: "/tmp/vertex-key.json" },
    })
    expect(vertexModel).toHaveBeenCalledWith("gemini-test")
  })

  test("requires Vertex project and credentials when provider is Vertex", async () => {
    await expect(createServiceModel(config({
      MEMEX_LLM_PROVIDER: "vertex",
      GOOGLE_APPLICATION_CREDENTIALS: "/tmp/vertex-key.json",
    }))).rejects.toThrow(/GOOGLE_VERTEX_PROJECT/)

    await expect(createServiceModel(config({
      MEMEX_LLM_PROVIDER: "vertex",
      GOOGLE_VERTEX_PROJECT: "vertex-project",
    }))).rejects.toThrow(/GOOGLE_APPLICATION_CREDENTIALS/)
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
