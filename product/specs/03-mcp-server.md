# Spec: MCP Server

**Priority:** Tier 1 — launch-blocking (high virality, low build cost)  
**Package name:** `@memexai/mcp`  
**Status:** Not started

---

## Why

MCP (Model Context Protocol) is the standard way for Claude Desktop, Cursor, Windsurf, and any other MCP-compatible client to discover and use tools. By shipping an MCP server, memexai becomes instantly usable by anyone running Claude Desktop — they add two lines to their config and memory tools appear in every conversation.

This is the highest-virality, lowest-cost item on the launch list:
- No auth complexity (direct mode is local-only)
- Build cost: ~200 lines wrapping existing tool definitions
- Discovery: users share `claude_desktop_config.json` snippets on Twitter/HN

---

## What It Does

Exposes all memexai memory tools over the MCP protocol via stdio. Compatible with any MCP client.

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "memexai": {
      "command": "npx",
      "args": ["@memexai/mcp", "--database-url", "postgresql://..."]
    }
  }
}
```

After adding this, Claude Desktop has `memory_list`, `memory_read`, `memory_write`, `memory_patch`, `memory_smart_read` available in every conversation.

---

## Two Modes

### Direct Postgres (recommended for local use)

```bash
npx @memexai/mcp --database-url postgresql://...
# or
npx @memexai/mcp  # reads DATABASE_URL or MEMEX_DATABASE_URL from env
```

- Creates a `pg.Pool` directly
- Runs `migrate()` on startup
- Binds to stdio (MCP protocol)
- No auth — process is local, same as `npx @memexai/admin`

### HTTP service proxy

```bash
npx @memexai/mcp --url http://localhost:8080 --api-key dev-agent-key
```

- Proxies tool calls to the running HTTP service
- Useful when the service is deployed remotely
- Requires `--api-key` (or `MEMEX_API_KEY` env var)

---

## Tools Exposed

All tools from `@memexai/core` tool definitions:

| MCP Tool | Description |
|---|---|
| `memory_list` | List memory files |
| `memory_read` | Read a file by path |
| `memory_write` | Create or overwrite a file |
| `memory_patch` | Append under heading or replace text |
| `memory_smart_read` | Read all/relevant files merged (see spec 02) |
| `memory_search` | BM25 keyword search (see spec 02) |

**userId context:** In MCP mode, `userId` is configured at server start (not per-call). The server is scoped to a single user — this matches the "personal assistant" use case where Claude Desktop is your personal agent.

```bash
npx @memexai/mcp --database-url postgresql://... --user-id my_user_123 --actor claude-desktop
```

If `--user-id` not provided, defaults to `"default"` with a warning.

---

## Package Structure

```
packages/mcp/
  package.json
  src/
    cli.ts      # arg parsing, mode selection, startup
    server.ts   # MCP server using @modelcontextprotocol/sdk
    direct.ts   # direct Postgres mode
    proxy.ts    # HTTP proxy mode
  tsconfig.json
```

**Build:** `tsup src/cli.ts --format esm --platform node --target node20`

---

## package.json

```json
{
  "name": "@memexai/mcp",
  "version": "0.1.0",
  "description": "MCP server for memexai — add persistent memory tools to Claude Desktop, Cursor, and any MCP client",
  "bin": { "memexai-mcp": "./dist/cli.js" },
  "dependencies": {
    "@memexai/core": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": { "tsup": "^8.5.1" }
}
```

---

## Server implementation sketch

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { toolDefinitions } from "@memexai/core"

const server = new McpServer({ name: "memexai", version: "0.1.0" })

for (const tool of toolDefinitions) {
  server.tool(tool.name, tool.description, tool.inputSchema.properties ?? {}, async (args) => {
    const result = await user.executeTool(tool.name, args)
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
  })
}

const transport = new StdioServerTransport()
await server.connect(transport)
```

---

## Claude Desktop config examples (for README)

**Direct Postgres (local):**
```json
{
  "mcpServers": {
    "memexai": {
      "command": "npx",
      "args": ["-y", "@memexai/mcp", "--database-url", "postgresql://user:pass@localhost:5432/mydb"]
    }
  }
}
```

**Docker service:**
```json
{
  "mcpServers": {
    "memexai": {
      "command": "npx",
      "args": ["-y", "@memexai/mcp", "--url", "http://localhost:8080", "--api-key", "dev-agent-key"]
    }
  }
}
```

---

## Verification

1. `bun run build` in `packages/mcp/` — produces `dist/cli.js`
2. `node dist/cli.js --database-url postgresql://...` — server starts without error
3. Add to `claude_desktop_config.json`, restart Claude Desktop, verify memory tools appear in tool picker
4. Write a file via Claude Desktop, open `npx @memexai/admin` and verify revision appears
5. Publish: `bun publish` in `packages/mcp/`
