# MemexAI + Anthropic SDK Service Mode

This example uses the MemexAI Docker service through `@memexai/sdk` and the Anthropic Messages API.

It demonstrates three paths:

1. `memory_remember` for a durable user preference.
2. `memory_context` for a later recall answer.
3. App-owned extraction from a permanent tool failure into `memory.remember(...)`.

The sibling `examples/anthropic` example uses direct Postgres mode through `@memexai/core`.

## Setup

Start MemexAI from the repo root:

```bash
docker compose up -d
```

Configure the example:

```bash
cd examples/anthropic-service
cp .env.example .env
```

Set:

```bash
ANTHROPIC_API_KEY=...
```

## Run

```bash
bun install
bun run start
```

## Why This Shape

The Anthropic SDK provides tool calling, not a native memory abstraction. The MemexAI adapter supplies Anthropic-compatible tool definitions and a handler that executes tool-use blocks against the MemexAI service.

Extraction stays in the application. If an app tool returns a permanent, reusable constraint such as an SQL dialect limitation, pass a compact fact to `memory.remember(...)`. Do not pass raw tool dumps, transient failures, or secrets.

For cross-user operational facts, add a routing rule in `shared/index.md` and enable `MEMEX_SHARED_WRITE_MODE=rw` only in trusted deployments.
