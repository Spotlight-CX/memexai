# MemexAI

Persistent memory for AI agents.

MemexAI gives agents a simple way to remember useful context across sessions, while giving humans a clean admin UI to inspect what was remembered, when it changed, and which tool call touched it.

It is intentionally simple: memory is stored as human-readable files, organized by path, backed by Postgres, and exposed through a REST API plus TypeScript SDK.

## Why

AI agents forget between runs.

Most projects solve that by hiding memory in prompts, vector blobs, or app-specific tables. That works for a demo, but it becomes hard to answer basic questions:

- What does the agent remember about this user?
- Who wrote or changed that memory?
- Which tool call caused the update?
- Can a human inspect and debug it?

MemexAI treats memory like infrastructure: durable, readable, revisioned, and inspectable.

## What You Get

- REST API for agent memory tools
- TypeScript SDK
- Vercel AI SDK, OpenAI, and LangChain adapters
- Postgres persistence
- File-style memory paths like `user/profile.md` and `shared/index.md`
- Revision history for writes and patches
- Access logs for reads and writes
- Admin dashboard for browsing memory
- Docker Compose setup for local demos

## Quick Start

```bash
bun install --registry=https://registry.npmmirror.com
docker compose up -d --build
bun run seed:admin
```

Open the admin dashboard:

```text
http://localhost:8080/admin
```

Use the default admin secret:

```text
dev-admin-secret
```

You should see seeded users, files, revisions, and access logs.

## Try the Agent Demo

Smoke test without an LLM key:

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
bun run demo:agent -- --smoke
```

Inspect memory from the terminal:

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
bun run demo:inspect
```

Run a live demo agent with Gemini:

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
GEMINI_API_KEY=... \
bun run demo:agent -- "Remember that I prefer quiet projects near good schools"
```

Then refresh the admin dashboard and inspect what changed.

## SDK Usage

```ts
import { MemexAI } from "@memexai/sdk"

const memex = new MemexAI({
  url: "http://localhost:8080",
  apiKey: "dev-agent-key",
})

const memory = memex.forUser({
  userId: "demo_user",
  actor: "assistant",
})

await memory.writeFile({
  path: "user/profile.md",
  content: [
    "# Profile",
    "",
    "- Prefers quiet projects near good schools",
    "- Budget is around 2.5 Cr",
  ].join("\n"),
  reason: "Captured stable user preferences",
})

const profile = await memory.readFile({ path: "user/profile.md" })
console.log(profile.content)
```

## Agent Harness Example

Most agent apps already have a loop that does three things:

1. Build system context
2. Bind tools
3. Let the model call tools

MemexAI fits into that harness as the memory layer:

```ts
import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { MemexAI } from "@memexai/sdk"
import { createVercelAITools } from "@memexai/sdk/adapters/vercel-ai"

const memex = new MemexAI({
  url: process.env.MEMEX_URL!,
  apiKey: process.env.MEMEX_API_KEY!,
})

const memory = memex.forUser({
  userId: "demo_user",
  actor: "assistant",
})

const promptBlock = await memory.getPromptBlock()
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
})

const result = await generateText({
  model: google("gemini-2.5-flash"),
  system: [
    "You are a helpful agent with durable memory.",
    "Use memory tools when the user asks you to remember, retrieve, or update stable preferences.",
    "Write user-specific notes under user/**. Do not write shared/**.",
    "",
    promptBlock,
  ].join("\n"),
  prompt: "Remember that I prefer quiet projects near good schools.",
  tools: createVercelAITools(memory),
  stopWhen: stepCountIs(5),
})

console.log(result.text)
```

The adapter converts MemexAI memory operations into model-callable tools. After the run, open the admin dashboard to see the file content, revision, actor, and tool call trail.

## Agent Memory Tools

Agents can use four simple tools:

- `memory_list`: list visible memory files
- `memory_read`: read a memory file
- `memory_write`: create or overwrite a user memory file
- `memory_patch`: append under a heading or replace exact text

MemexAI also exposes a prompt block endpoint so agents can load relevant memory instructions/context before tool use.

## Admin Dashboard

The admin UI is built for inspection:

- Browse memory as a file tree
- Read content in a document-style viewer
- Click historical revisions
- Review users and file counts
- Audit reads, writes, patches, actors, and tool call IDs

For frontend-only admin development while Docker serves the backend:

```bash
bun run dev:admin
```

Open:

```text
http://localhost:5174/admin/
```

The Vite dev server proxies `/v1` requests to `http://localhost:8080`.

## Useful Commands

Clean rebuild Docker, including the Postgres volume:

```bash
scripts/clean-rebuild.sh --yes
```

Seed demo admin data:

```bash
bun run seed:admin
```

Build everything:

```bash
bun run build
```

Run tests:

```bash
bun run test
```

## Defaults

Docker Compose starts:

- API and admin UI: `http://localhost:8080`
- Postgres: `localhost:5433`
- Agent API key: `dev-agent-key`
- Admin secret: `dev-admin-secret`

Environment used by the service:

```bash
PORT=8080
DATABASE_URL=postgresql://memexai:memexai@postgres:5432/memexai
MEMEX_API_KEY=dev-agent-key
MEMEX_ADMIN_SECRET=dev-admin-secret
```

## Hackathon Deck

Present the Markdown deck in a browser with Marp:

```bash
PORT=5176 npm_config_registry=https://registry.npmmirror.com \
npx -y @marp-team/marp-cli -s docs
```

Open:

```text
http://localhost:5176/hackathon-deck.md
```

## Status

MemexAI is a hackathon-stage project focused on making agent memory easy to run, inspect, and explain. The current goal is a clean local developer experience and a simple memory model that is understandable to both agents and humans.
