import { z } from "zod"

const optionalNonEmptyString = z.preprocess((value) => value === "" ? undefined : value, z.string().optional())
const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === undefined) return undefined
  if (value === true || value === false) return value
  if (typeof value === "string") {
    if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true
    if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false
  }
  return value
}, z.boolean().default(false))

const envSchema = z.object({
  NODE_ENV: optionalNonEmptyString,
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  MEMEX_API_KEY: z.string().min(1),
  MEMEX_ADMIN_SECRET: optionalNonEmptyString,
  MEMEX_LLM_PROVIDER: z.preprocess((value) => value === "" ? undefined : value, z.enum(["google", "openai", "ollama", "vertex"]).optional()),
  GEMINI_API_KEY: optionalNonEmptyString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalNonEmptyString,
  GEMINI_MODEL: optionalNonEmptyString,
  GOOGLE_GENERATIVE_AI_MODEL: optionalNonEmptyString,
  GOOGLE_VERTEX_PROJECT: optionalNonEmptyString,
  GOOGLE_VERTEX_LOCATION: optionalNonEmptyString,
  GOOGLE_VERTEX_MODEL: optionalNonEmptyString,
  GOOGLE_APPLICATION_CREDENTIALS: optionalNonEmptyString,
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_MODEL: optionalNonEmptyString,
  OLLAMA_BASE_URL: optionalNonEmptyString,
  OLLAMA_MODEL: optionalNonEmptyString,
  MEMEX_DREAM_ENABLED: optionalBoolean,
  MEMEX_TELEMETRY_DISABLED: optionalBoolean,
  MEMEX_TELEMETRY_POSTHOG_KEY: optionalNonEmptyString,
  MEMEX_TELEMETRY_POSTHOG_HOST: optionalNonEmptyString,
})

export type Config = z.infer<typeof envSchema> & {
  MEMEX_ADMIN_SECRET: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.parse(env)
  const isProduction = parsed.NODE_ENV === "production"
  const adminSecret = parsed.MEMEX_ADMIN_SECRET ?? (isProduction ? "" : "memex-admin-dev")

  if (!adminSecret) {
    throw new Error("MEMEX_ADMIN_SECRET is required in production")
  }

  return {
    ...parsed,
    MEMEX_ADMIN_SECRET: adminSecret,
  }
}
