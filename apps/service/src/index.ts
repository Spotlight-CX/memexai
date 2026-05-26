import { loadConfig } from "./config"
import { createPool } from "./db"
import { runMigrations } from "./migrations"
import { createServiceModel } from "./model"
import { buildServer } from "./server"
import { readDreamConfig, resetStaleDreamRuns, runDreamCycle } from "@memexai/core"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createConnectionScopedMcpServer } from "./mcp"

async function main() {
  const config = loadConfig()
  const modelConfig = await createServiceModel(config)
  const db = createPool(config.DATABASE_URL)
  await runMigrations(db)
  let dreamTimer: ReturnType<typeof setInterval> | undefined

  if (config.MEMEX_DREAM_ENABLED) {
    await resetStaleDreamRuns(db)
    const dreamConfig = await readDreamConfig(db)
    const runDreamTick = async () => {
      const latestDreamConfig = await readDreamConfig(db)
      if (!latestDreamConfig.enabled) return
      if (!modelConfig?.model) {
        console.warn("MemexAI dream loop skipped: no model configured")
        return
      }
      await runDreamCycle(db, latestDreamConfig, { model: modelConfig.model })
    }

    dreamTimer = setInterval(() => {
      runDreamTick().catch((error) => {
        console.error("MemexAI dream loop failed", error)
      })
    }, dreamConfig.intervalMinutes * 60_000)
    dreamTimer.unref?.()
    console.error(`MemexAI dream loop enabled (${dreamConfig.intervalMinutes} min interval)`)
  }

  if (process.argv.includes("--stdio") || process.argv.includes("--mcp")) {
    const getArgValue = (flag: string, fallback: string): string => {
      const idx = process.argv.indexOf(flag)
      if (idx >= 0 && idx + 1 < process.argv.length) {
        return process.argv[idx + 1]
      }
      return fallback
    }
    const userId = getArgValue("--user-id", "default")
    const actor = getArgValue("--actor", "claude-desktop")

    const server = createConnectionScopedMcpServer(db, { userId, actor }, modelConfig?.model)
    const transport = new StdioServerTransport()
    await server.connect(transport)

    console.error(`MemexAI MCP server running on stdio (user: ${userId})`)

    const close = async () => {
      if (dreamTimer) clearInterval(dreamTimer)
      await db.end()
      process.exit(0)
    }

    process.once("SIGINT", close)
    process.once("SIGTERM", close)
    return
  }

  const app = buildServer({ db, config, model: modelConfig?.model })
  await app.listen({ port: config.PORT, host: "0.0.0.0" })

  const close = async () => {
    if (dreamTimer) clearInterval(dreamTimer)
    await app.close()
    await db.end()
  }

  process.once("SIGINT", close)
  process.once("SIGTERM", close)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
