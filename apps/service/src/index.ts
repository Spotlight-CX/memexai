import { loadConfig } from "./config"
import { createPool } from "./db"
import { runMigrations } from "./migrations"
import { buildServer } from "./server"

async function main() {
  const config = loadConfig()
  const db = createPool(config.DATABASE_URL)
  await runMigrations(db)

  const app = buildServer({ db, config })
  await app.listen({ port: config.PORT, host: "0.0.0.0" })

  const close = async () => {
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
