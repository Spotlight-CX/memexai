import { z } from "zod"

const optionalNonEmptyString = z.preprocess((value) => value === "" ? undefined : value, z.string().optional())

const envSchema = z.object({
  NODE_ENV: optionalNonEmptyString,
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  MEMEX_API_KEY: z.string().min(1),
  MEMEX_ADMIN_SECRET: optionalNonEmptyString,
  MEMEX_LLM_PROVIDER: z.preprocess((value) => value === "" ? undefined : value, z.enum(["google", "openai"]).optional()),
  GEMINI_API_KEY: optionalNonEmptyString,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalNonEmptyString,
  GEMINI_MODEL: optionalNonEmptyString,
  GOOGLE_GENERATIVE_AI_MODEL: optionalNonEmptyString,
  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_MODEL: optionalNonEmptyString,
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
