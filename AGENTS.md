# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Facts

- Public website hostname: `memexai.space`. Use this for canonical URLs, OpenGraph URLs, sitemap, robots, GTM notes, docs links, and public copy. Do not use `memexai.dev`.

## Commands

```bash
# Build all packages in dependency order
bun run build

# Build individual packages
bun run build:core        # @memexai/core (pg-direct library)
bun run build:sdk         # @memexai/sdk (HTTP client)
bun run build:service     # apps/service (Fastify HTTP server)
bun run build:admin-cli   # packages/admin-cli (npx CLI)

# Tests
bun run test              # run all tests once
bun run test:watch        # watch mode

# Run a single test file
bun test packages/core/tests/paths.test.ts

# Development (HTTP service with hot reload)
bun run dev               # starts apps/service with tsx watch
bun run dev:admin         # starts admin React UI with Vite

# Docker (full stack: Postgres + service + admin UI)
docker compose up -d      # Postgres on 5433, API+admin on 8080

# Admin UI (direct Postgres, no Docker)
bun run admin             # connects to local Postgres on 5433
bun run admin:dev         # admin UI dev server with Vite HMR

# Demo agent
bun run demo:agent -- "Remember I prefer 2BHK apartments"
bun run demo:agent -- --direct "..."   # bypass HTTP, use pg directly
```

## Architecture

The repo is a Bun workspace monorepo with two deployment modes sharing the same Postgres schema:

### Mode 1: Direct Postgres — `@memexai/core`
`packages/core` connects directly via `pg.Pool`. Import it, call `migrate()` once, use `createMemex(DATABASE_URL)`. No HTTP layer. Best for single-process apps and serverless.

### Mode 2: HTTP service — `@memexai/sdk` + `apps/service`
`apps/service` is a Fastify app that owns the Postgres connection. Clients use `@memexai/sdk` (HTTP + API key). Docker Compose bundles Postgres, the service, and the React admin UI into a single stack.

### Package map

| Package | Role |
|---|---|
| `packages/core` | Core logic: pg pool, migrations, path translation, tool execution, framework adapters |
| `packages/sdk` | HTTP client for the service: `MemexAI`, `MemexMemory`, adapter re-exports |
| `apps/service` | Fastify HTTP service + React admin UI (Vite build) |
| `packages/admin-cli` | `npx @memexai/admin` — standalone admin UI for direct-Postgres mode |
| `apps/demo-agent` | Integration demo: Vercel AI SDK + Gemini, supports both modes via `--direct` flag |

### Core data flow

```
AI model → tool call → framework adapter → executeTool(db, name, args, ctx)
  → path validation → virtual→physical translation → SQL (mx_file / mx_revision / mx_access_log)
```

This path is identical in both modes. Adapters for Vercel AI SDK, Anthropic SDK, and LangChain live in `packages/core/src/adapters/`.

### Memory model

Memory files live in `mx_file` under a two-level virtual path namespace:

- `user/` → translated to `users/{userId}/` (private, read+write)
- `shared/` → `shared/` unchanged (global, read-only for agents)

Path translation happens in `packages/core/src/paths.ts`. Agents never see physical paths. `assertWritableVirtualPath` enforces the read-only mount for `shared/`.

The four agent tools are `memory_list`, `memory_read`, `memory_write`, `memory_patch`. Two agentic tools (`memory_memorize`, `memory_search`) wrap these with LLM-assisted resolution. All definitions are in `packages/core/src/tool-definitions.ts`.

`getPromptBlock()` / `buildPromptBlock()` assembles an XML block injected into the model's system prompt, including tool definitions and any existing `shared/index.md`, `shared/AGENTS.md`, and `user/index.md` content.

### Database schema

Four tables, all prefixed `mx_`:

| Table | Purpose |
|---|---|
| `mx_migration` | Tracks applied migrations (prevents re-runs) |
| `mx_file` | One row per memory file: `physical_path`, `content_text`, timestamps, `search_vector` (tsvector GIN) |
| `mx_revision` | Full content snapshot per write: actor, reason, tool_call_id |
| `mx_access_log` | Lightweight log of every read and write |

Migrations are inlined as string constants in `packages/core/src/migrations.ts` (and mirrored in `apps/service/migrations/*.sql`). Migration IDs are permanent once applied — never change them.

### Service HTTP API

All agent routes require `Authorization: Bearer <MEMEX_API_KEY>`. Admin routes require `x-admin-secret: <MEMEX_ADMIN_SECRET>`.

```
GET  /health
GET  /v1/tools                          → list tool definitions
POST /v1/tools/:toolName/execute        → execute a tool
GET  /v1/prompt-block?userId=...        → build system prompt block
POST /v1/prompt-block                   → same, body-based

GET  /v1/admin/users
GET  /v1/admin/files
GET  /v1/admin/files/*
PUT  /v1/admin/files/*
GET  /v1/admin/revisions
GET  /v1/admin/access-logs
GET  /admin/*                           → React admin UI static files
```

### Environment variables

**Service (`apps/service`):**
- `DATABASE_URL` — Postgres connection string
- `MEMEX_API_KEY` — comma-separated valid agent API keys (default in Docker: `dev-agent-key`)
- `MEMEX_ADMIN_SECRET` — admin route secret (default in Docker: `dev-admin-secret`)
- `PORT` — HTTP port (default: 8080)

**Docker Compose defaults:** Postgres on 5433 (`memexai:memexai@localhost:5433/memexai`), service+admin on 8080.

## Adding a migration

Append a new entry to the `MIGRATIONS` array in `packages/core/src/migrations.ts`. IDs must be unique, zero-padded, and never change after first apply. SQL must be idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`). Also add the `.sql` file under `apps/service/migrations/` to keep the service in sync.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
