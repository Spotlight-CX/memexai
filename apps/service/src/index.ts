import { loadConfig } from "./config"
import { createPool } from "./db"
import { runMigrations } from "./migrations"
import { createServiceModel } from "./model"
import { buildServer } from "./server"
import { readDreamConfig, resetStaleDreamRuns, runDreamCycle } from "@memexai/core"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createConnectionScopedMcpServer } from "./mcp"
import { countBucket, createTelemetryClient } from "./telemetry"

async function main() {
  const config = loadConfig()
  const modelConfig = await createServiceModel(config)
  console.error(`MemexAI model provider: ${modelConfig ? `${modelConfig.provider}/${modelConfig.modelName}` : "none"}`)
  const db = createPool(config.DATABASE_URL)
  await runMigrations(db)
  const telemetry = await createTelemetryClient({ config, db, serviceVersion: process.env.npm_package_version })
  telemetry.capture("service_started", {
    node_env: config.NODE_ENV ?? "unknown",
    model_provider: modelConfig?.provider ?? "none",
    dream_enabled: config.MEMEX_DREAM_ENABLED,
    mcp_available: true,
    deployment: process.env.KUBERNETES_SERVICE_HOST ? "kubernetes" : process.env.HOSTNAME ? "container_or_host" : "unknown",
  })
  let dreamTimer: ReturnType<typeof setInterval> | undefined

  if (config.MEMEX_DREAM_ENABLED) {
    await resetStaleDreamRuns(db)
    const dreamConfig = await readDreamConfig(db)
    const runDreamTick = async () => {
      const latestDreamConfig = await readDreamConfig(db)
      if (!latestDreamConfig.enabled) return
      if (!modelConfig?.model) {
        telemetry.capture("dream_cycle_run", { status: "no_model" })
        console.warn("MemexAI dream loop skipped: no model configured")
        return
      }
      const result = await runDreamCycle(db, latestDreamConfig, { model: modelConfig.model })
      telemetry.capture("dream_cycle_run", {
        status: result.status,
        files_touched_bucket: countBucket(result.filesTouched),
      })
    }

    dreamTimer = setInterval(() => {
      runDreamTick().catch((error) => {
        telemetry.capture("dream_cycle_run", { status: "error", error_code: error instanceof Error ? error.name || "ERROR" : "ERROR" })
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
    telemetry.capture("mcp_session_started", { transport: "stdio" })

    console.error(`MemexAI MCP server running on stdio (user: ${userId})`)

    const close = async () => {
      if (dreamTimer) clearInterval(dreamTimer)
      await telemetry.flush()
      await db.end()
      process.exit(0)
    }

    process.once("SIGINT", close)
    process.once("SIGTERM", close)
    return
  }

  const app = buildServer({ db, config, model: modelConfig?.model, telemetry })
  await app.listen({ port: config.PORT, host: "0.0.0.0" })

  const close = async () => {
    if (dreamTimer) clearInterval(dreamTimer)
    await telemetry.flush()
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
