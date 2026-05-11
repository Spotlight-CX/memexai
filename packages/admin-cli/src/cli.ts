#!/usr/bin/env node
import { startAdminServer } from "./server"

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }
  const has = (flag: string) => args.includes(flag)

  const databaseUrl =
    get("--database-url") ??
    get("-d") ??
    process.env["DATABASE_URL"] ??
    process.env["MEMEX_DATABASE_URL"]

  const portStr = get("--port") ?? get("-p") ?? "4040"
  const port = Number.parseInt(portStr, 10)
  const noOpen = has("--no-open")

  if (has("--help") || has("-h")) {
    console.log(`
Usage: memex-admin [options]

Options:
  --database-url, -d  Postgres connection URL (or set DATABASE_URL env var)
  --port, -p          Port to listen on (default: 4040)
  --no-open           Do not open the browser automatically
  --help, -h          Show this help message

Examples:
  npx memex-admin --database-url postgresql://user:pass@localhost/mydb
  DATABASE_URL=postgresql://... npx memex-admin --port 5050
    `)
    process.exit(0)
  }

  if (!databaseUrl) {
    console.error("Error: --database-url is required (or set the DATABASE_URL environment variable)")
    process.exit(1)
  }

  if (Number.isNaN(port) || port < 1 || port > 65535) {
    console.error(`Error: invalid port ${portStr}`)
    process.exit(1)
  }

  return { databaseUrl, port, open: !noOpen }
}

const options = parseArgs()
startAdminServer(options).catch((err) => {
  console.error("Failed to start memex-admin:", err)
  process.exit(1)
})
