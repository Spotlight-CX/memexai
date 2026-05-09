import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1),
  MEMEX_API_KEY: z.string().min(1),
  MEMEX_ADMIN_SECRET: z.string().optional(),
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
