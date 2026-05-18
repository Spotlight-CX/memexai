import type { Config } from "./config"

type ModelFactoryInput = {
  google?: (options: { apiKey: string }) => (modelName: string) => unknown
  openai?: (modelName: string) => unknown
}

export type ServiceModelConfig = {
  provider: "google" | "openai" | "ollama"
  modelName: string
  model: unknown
}

export async function createServiceModel(config: Config, factories: ModelFactoryInput = {}): Promise<ServiceModelConfig | undefined> {
  const provider = chooseProvider(config)
  if (!provider) return undefined

  if (provider === "google") {
    const apiKey = config.GEMINI_API_KEY ?? config.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is required for MEMEX_LLM_PROVIDER=google")
    const modelName = config.GEMINI_MODEL ?? config.GOOGLE_GENERATIVE_AI_MODEL ?? "gemini-2.5-flash"
    const google = factories.google ?? (await import("@ai-sdk/google")).createGoogleGenerativeAI
    return {
      provider,
      modelName,
      model: google({ apiKey })(modelName),
    }
  }

  if (provider === "ollama") {
    const baseURL = (config.OLLAMA_BASE_URL ?? "http://localhost:11434") + "/v1"
    const modelName = config.OLLAMA_MODEL ?? "llama3.2"
    const { createOpenAI } = await import("@ai-sdk/openai")
    return { provider, modelName, model: createOpenAI({ baseURL, apiKey: "ollama" })(modelName) }
  }

  const apiKey = config.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for MEMEX_LLM_PROVIDER=openai")
  const modelName = config.OPENAI_MODEL ?? "gpt-4.1-mini"
  const makeOpenAIModel = factories.openai ?? (await import("@ai-sdk/openai")).openai
  return {
    provider,
    modelName,
    model: makeOpenAIModel(modelName),
  }
}

function chooseProvider(config: Config): "google" | "openai" | "ollama" | undefined {
  if (config.MEMEX_LLM_PROVIDER) return config.MEMEX_LLM_PROVIDER
  if (config.GEMINI_API_KEY || config.GOOGLE_GENERATIVE_AI_API_KEY) return "google"
  if (config.OPENAI_API_KEY) return "openai"
  if (config.OLLAMA_MODEL) return "ollama"
  return undefined
}
