import { describe, expect, test } from "vitest"
import { loadConfig } from "../src/config"

describe("config", () => {
  test("uses a dev admin secret outside production", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://localhost/memexai",
      MEMEX_API_KEY: "dev-key",
    })

    expect(config.MEMEX_ADMIN_SECRET).toBe("memex-admin-dev")
  })

  test("requires an admin secret in production", () => {
    expect(() => loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost/memexai",
      MEMEX_API_KEY: "prod-key",
    })).toThrow(/MEMEX_ADMIN_SECRET/)
  })

  test("loads optional model env", () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://localhost/memexai",
      MEMEX_API_KEY: "dev-key",
      MEMEX_LLM_PROVIDER: "openai",
      OPENAI_API_KEY: "openai-key",
      OPENAI_MODEL: "gpt-test",
    })

    expect(config.MEMEX_LLM_PROVIDER).toBe("openai")
    expect(config.OPENAI_API_KEY).toBe("openai-key")
    expect(config.OPENAI_MODEL).toBe("gpt-test")
  })
})
