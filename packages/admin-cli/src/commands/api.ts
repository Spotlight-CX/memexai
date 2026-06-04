import type { AdminClient } from "../client"
import { printJson, printError } from "../output"
import { flag, type ParsedArgs } from "../args"

const HELP = `
Usage: memex-admin api <METHOD> <path> [--body '{"key":"val"}']
       memex-admin api-spec

Raw HTTP passthrough to the admin service API (requires --service-url).

Examples:
  memex-admin --service-url http://localhost:8080 api GET /v1/admin/users
  memex-admin --service-url http://localhost:8080 api PUT /v1/admin/files/shared/index.md \\
    --body '{"content":"# Memory","reason":"update"}'
  memex-admin --service-url http://localhost:8080 api-spec
`

export async function apiCommand(
  sub: string | undefined,
  args: ParsedArgs,
  client: AdminClient,
  _jsonMode: boolean,
): Promise<void> {
  if (!sub || sub === "--help" || sub === "-h") {
    process.stdout.write(HELP)
    return
  }

  if (client.mode !== "http") {
    printError("api and api-spec commands require --service-url (HTTP proxy mode)")
    process.exit(1)
  }

  // sub is the HTTP method, positional[0] is the path
  const method = sub.toUpperCase()
  const path = args.positional[0]
  if (!path) { printError("path is required", "MISSING_ARG"); process.exit(2) }

  const bodyStr = flag(args.flags, "body")
  let body: unknown
  if (bodyStr) {
    try { body = JSON.parse(bodyStr) } catch {
      printError("Invalid JSON in --body")
      process.exit(2)
    }
  }

  const result = await client.rawRequest(method, path, body)
  printJson(result)
}

export async function apiSpecCommand(
  client: AdminClient,
): Promise<void> {
  if (client.mode !== "http") {
    printError("api-spec requires --service-url (HTTP proxy mode)")
    process.exit(1)
  }
  const result = await client.rawRequest("GET", "/v1/openapi.json")
  printJson(result)
}
