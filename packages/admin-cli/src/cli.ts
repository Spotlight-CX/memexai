#!/usr/bin/env node
import { createClient } from "./client"
import { printError } from "./output"
import { parseArgs, flag, boolFlag } from "./args"
import { startAdminServer } from "./server"
import { usersCommand } from "./commands/users"
import { filesCommand } from "./commands/files"
import { revisionsCommand } from "./commands/revisions"
import { logsCommand } from "./commands/logs"
import { traceCommand } from "./commands/trace"
import { memoryCommand } from "./commands/memory"
import { dreamCommand } from "./commands/dream"
import { setupCommand } from "./commands/setup"
import { observeCommand } from "./commands/observe"
import { apiCommand, apiSpecCommand } from "./commands/api"
import { initCommand } from "./commands/init"
import { sharedCommand } from "./commands/shared"

const HELP = `
memex-admin — Agent-friendly CLI for MemexAI memory inspection and management

Usage: memex-admin [global options] <command> [subcommand] [options]

Global options:
  --database-url, -d <url>     Postgres connection URL (or DATABASE_URL env)
  --service-url, -s <url>      HTTP service URL (or MEMEX_SERVICE_URL env)
  --admin-secret <secret>      Admin secret (or MEMEX_ADMIN_SECRET env)
  --user, -u <userId>          Default user for user-scoped commands
  --json                       Output raw JSON to stdout
  --no-color                   Disable color output
  --help, -h                   Show this help

Commands:
  init                         Guided setup: introspect codebase, start Docker, bootstrap memory
  shared                       Sync shared/ memory files (pull from service, push to service)
  serve                        Start web UI (default port 4040)
  users                        User management
  files                        File management
  revisions                    Revision history and diffs
  logs                         Access log inspection
  trace                        Agentic route tracing
  memory                       Memory state and time-travel
  dream                        Dream cycle management
  setup                        Bootstrap shared memory (manual)
  observe                      Observability and analytics
  api                          Raw HTTP passthrough (service mode only)
  api-spec                     Print OpenAPI spec (service mode only)

Run 'memex-admin <command> --help' for command-specific help.

Connection modes:
  Direct Postgres:  --database-url postgresql://user:pass@host/db
  HTTP service:     --service-url http://localhost:8080 --admin-secret <secret>

Getting started:
  npx @memexai/admin init

Examples:
  memex-admin -s http://localhost:8080 --admin-secret secret shared push
  memex-admin -d $DATABASE_URL --json users list
  memex-admin -d $DATABASE_URL files get shared/index.md
  memex-admin -d $DATABASE_URL memory snapshot --user alice --at "2025-06-01T10:00:00Z"
  memex-admin -d $DATABASE_URL trace tc_abc123
  memex-admin -s http://localhost:8080 --admin-secret secret api GET /v1/admin/users
`

async function main() {
  const argv = process.argv.slice(2)
  const parsed = parseArgs(argv)

  // Global flags
  const databaseUrl = flag(parsed.flags, "database-url", "d")
    ?? process.env["DATABASE_URL"]
    ?? process.env["MEMEX_DATABASE_URL"]
  const serviceUrl = flag(parsed.flags, "service-url", "s")
    ?? process.env["MEMEX_SERVICE_URL"]
  const adminSecret = flag(parsed.flags, "admin-secret")
    ?? process.env["MEMEX_ADMIN_SECRET"]
  const jsonMode = boolFlag(parsed.flags, "json")
  const defaultUser = flag(parsed.flags, "user", "u")

  const command = parsed.positional[0]
  const subCommand = parsed.positional[1]
  const restArgs = {
    positional: parsed.positional.slice(2),
    flags: { ...parsed.flags, ...(defaultUser ? { user: defaultUser } : {}) },
  }

  if (!command || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP)
    process.exit(0)
  }

  // init — manages its own client lifecycle (service may not be running yet)
  if (command === "init") {
    await initCommand(
      { positional: parsed.positional.slice(1), flags: parsed.flags },
      { serviceUrl, adminSecret, databaseUrl, jsonMode },
    )
    return
  }

  // Handle --help for subcommands before creating the client (no DB needed)
  if (boolFlag(parsed.flags, "help", "h")) {
    const helpArgs = { positional: [], flags: { help: true } }
    switch (command) {
      case "users": await usersCommand(undefined, helpArgs, null as never, false); break
      case "files": await filesCommand(undefined, helpArgs, null as never, false); break
      case "revisions": await revisionsCommand(undefined, helpArgs, null as never, false); break
      case "logs": await logsCommand(undefined, helpArgs, null as never, false); break
      case "trace": await traceCommand(undefined, helpArgs, null as never, false); break
      case "memory": await memoryCommand(undefined, helpArgs, null as never, false); break
      case "dream": await dreamCommand(undefined, helpArgs, null as never, false); break
      case "setup": await setupCommand(undefined, helpArgs, null as never, false); break
      case "observe": await observeCommand(undefined, helpArgs, null as never, false); break
      case "api": await apiCommand(undefined, helpArgs, null as never, false); break
      case "shared": await sharedCommand(undefined, helpArgs, null as never, false); break
      default: process.stdout.write(HELP)
    }
    process.exit(0)
  }

  // serve — no client needed
  if (command === "serve") {
    const db = databaseUrl
    if (!db) {
      printError("--database-url (or DATABASE_URL) is required for serve mode")
      process.exit(1)
    }
    const portStr = flag(parsed.flags, "port", "p") ?? "4040"
    const port = parseInt(portStr, 10)
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      printError(`Invalid port: ${portStr}`)
      process.exit(2)
    }
    const noOpen = boolFlag(parsed.flags, "no-open")
    await startAdminServer({ databaseUrl: db, port, open: !noOpen })
    return
  }

  // All other commands need a client
  const client = await createClient({
    databaseUrl,
    serviceUrl,
    adminSecret,
  }).catch((err: Error) => {
    printError(err.message)
    process.exit(1)
  })

  try {
    switch (command) {
      case "users":
        await usersCommand(subCommand, restArgs, client, jsonMode)
        break
      case "files":
        await filesCommand(subCommand, restArgs, client, jsonMode)
        break
      case "revisions":
        await revisionsCommand(subCommand, restArgs, client, jsonMode)
        break
      case "logs":
        await logsCommand(subCommand, restArgs, client, jsonMode)
        break
      case "trace":
        // trace <toolCallId> OR trace session --user <u>
        // subCommand may be "session" or the toolCallId itself
        await traceCommand(subCommand, restArgs, client, jsonMode)
        break
      case "memory":
        await memoryCommand(subCommand, restArgs, client, jsonMode)
        break
      case "dream":
        await dreamCommand(subCommand, restArgs, client, jsonMode)
        break
      case "setup":
        await setupCommand(subCommand, restArgs, client, jsonMode)
        break
      case "observe":
        await observeCommand(subCommand, restArgs, client, jsonMode)
        break
      case "api":
        await apiCommand(subCommand, restArgs, client, jsonMode)
        break
      case "api-spec":
        await apiSpecCommand(client)
        break
      case "shared":
        await sharedCommand(subCommand, restArgs, client, jsonMode)
        break
      default:
        printError(`Unknown command: ${command}. Run 'memex-admin --help' for usage.`)
        process.exit(1)
    }
  } catch (err) {
    const e = err as Error
    printError(e.message)
    process.exit(1)
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  printError(String(err))
  process.exit(1)
})
