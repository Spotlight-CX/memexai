#!/usr/bin/env node
import { ApiError, buildClient } from "./client"
import { cmdHealth } from "./commands/health"
import { cmdUsers } from "./commands/users"
import { cmdFiles } from "./commands/files"
import { cmdHistory } from "./commands/history"
import { cmdDream } from "./commands/dream"
import { cmdObserve } from "./commands/observe"
import { cmdDocs } from "./commands/docs"

// ─── Arg parser ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (!next || next.startsWith("--")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      positional.push(arg)
    }
  }

  return { flags, positional }
}

function str(v: string | boolean | undefined): string | undefined {
  return typeof v === "string" ? v : undefined
}

function num(v: string | boolean | undefined): number | undefined {
  if (typeof v !== "string") return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

// ─── Help ────────────────────────────────────────────────────────────────────

const HELP = `
memex-cli — MemexAI admin CLI

Usage: memex-cli <command> [args] [flags]

Global flags:
  --url <URL>       Service base URL (env: MEMEX_URL, default: http://localhost:8080)
  --secret <SECRET> Admin secret (env: MEMEX_ADMIN_SECRET)

Commands:
  health
    Ping the service.

  users [--q <search>] [--limit <n>]
    List users with file and activity stats.

  files [path] [--prefix <path>] [--as-of <ISO>] [--write <content>] [--reason <text>]
    Browse files, get a single file, or write a file.
    --as-of  Show memory state at this timestamp (ISO 8601)
    --write  Write content to <path> (requires positional path)

  history [--path <p>] [--user <id>] [--tool-call <id>]
         [--from <ISO>] [--to <ISO>] [--limit <n>] [--offset <n>]
         [--type revisions|logs|events]
    Query revision history and access logs.
    Default: returns both revisions and access logs merged.
    --tool-call  Filter by toolCallId (access logs only)

  dream [--user <id>] [--status <status>] [--from <ISO>] [--to <ISO>]
        [--limit <n>] [--run] [--pause] [--unpause]
    View dream loop state. --run triggers a cycle, --pause/--unpause a user.

  observe [--user <id>] [--from <ISO>] [--to <ISO>] [--tool <name>]
          [--mode summary|events|top|user] [--limit <n>]
    Observability data. Default mode: summary.

  docs [path] [--list] [--raw]
    Read project documentation. No admin secret required.
    --list  List all available docs
    --raw   Print raw markdown without JSON wrapper

Examples:
  memex-cli health
  memex-cli users --limit 10
  memex-cli files users/alice/
  memex-cli files users/alice/ --as-of 2026-06-01T00:00:00Z
  memex-cli history --tool-call tool_abc123
  memex-cli history --user alice --type logs
  memex-cli dream --user alice
  memex-cli observe --user alice --mode summary
  memex-cli docs roadmap/003-hybrid-search-rrf.md
  memex-cli docs --list
`.trim()

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { flags, positional } = parseArgs(process.argv)
  const command = positional[0]

  if (!command || flags["help"] || flags["h"]) {
    console.log(HELP)
    process.exit(0)
  }

  const url = str(flags["url"]) ?? process.env["MEMEX_URL"] ?? "http://localhost:8080"
  const secret = str(flags["secret"]) ?? process.env["MEMEX_ADMIN_SECRET"]

  const client = buildClient({ url, secret })
  const isTTY = process.stdout.isTTY
  const jsonFlag = flags["json"] === true

  let result: unknown

  try {
    switch (command) {
      case "health":
        result = await cmdHealth(client)
        break

      case "users":
        result = await cmdUsers(client, {
          q: str(flags["q"]),
          limit: num(flags["limit"]),
        })
        break

      case "files":
        result = await cmdFiles(client, {
          path: positional[1],
          prefix: str(flags["prefix"]),
          asOf: str(flags["as-of"]),
          write: str(flags["write"]),
          reason: str(flags["reason"]),
        })
        break

      case "history":
        result = await cmdHistory(client, {
          path: str(flags["path"]),
          user: str(flags["user"]),
          toolCall: str(flags["tool-call"]),
          from: str(flags["from"]),
          to: str(flags["to"]),
          limit: num(flags["limit"]),
          offset: num(flags["offset"]),
          type: str(flags["type"]) as "revisions" | "logs" | "events" | undefined,
        })
        break

      case "dream":
        result = await cmdDream(client, {
          user: str(flags["user"]),
          status: str(flags["status"]),
          from: str(flags["from"]),
          to: str(flags["to"]),
          limit: num(flags["limit"]),
          run: flags["run"] === true,
          pause: flags["pause"] === true,
          unpause: flags["unpause"] === true,
        })
        break

      case "observe":
        result = await cmdObserve(client, {
          user: str(flags["user"]),
          from: str(flags["from"]),
          to: str(flags["to"]),
          tool: str(flags["tool"]),
          mode: str(flags["mode"]) as "summary" | "events" | "top" | "user" | undefined,
          limit: num(flags["limit"]),
          offset: num(flags["offset"]),
        })
        break

      case "docs":
        result = await cmdDocs(client, {
          path: positional[1],
          list: flags["list"] === true,
          raw: flags["raw"] === true,
        })
        break

      default:
        console.error(`Unknown command: ${command}\nRun memex-cli --help for usage.`)
        process.exit(1)
    }
  } catch (err) {
    if (err instanceof ApiError) {
      console.error(JSON.stringify({ error: { status: err.status, code: err.code, message: err.message } }, null, 2))
    } else {
      console.error(err instanceof Error ? err.message : String(err))
    }
    process.exit(1)
  }

  if (!jsonFlag && isTTY) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    process.stdout.write(JSON.stringify(result) + "\n")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
