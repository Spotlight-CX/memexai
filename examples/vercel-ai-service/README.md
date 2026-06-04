# MemexAI + Vercel AI SDK Service Example

This is a minimal terminal example that uses the containerized MemexAI HTTP service with the Vercel AI SDK. It does not connect directly to Postgres.

The CLI has two turns:

- `remember` asks Gemini, through the Vercel AI SDK, to call MemexAI's `memory_memorize` agentic tool.
- `recall` asks Gemini to call `memory_search` and answer from durable memory.

## Setup

Start the MemexAI service from the repository root:

```bash
docker compose up -d
docker compose ps
```

The code defaults `MEMEX_URL` to `http://localhost:8080`, matching the compose service default. Verify the host port with `docker compose ps`; some local setups publish the service as `http://localhost:18080`.

Install dependencies and build the local SDK package:

```bash
bun install
bun run build:sdk
cd examples/vercel-ai-service
bun install
```

The example depends on the local SDK package through `file:../../packages/sdk`, so rebuild the SDK after changing `packages/sdk`.

Add `GEMINI_API_KEY` to the repository `.env` or export it in your shell. The example loads the repo `.env` and an optional local `examples/vercel-ai-service/.env`.

## Environment Variables

| Name | Default | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | required | Google AI Studio key used by `@ai-sdk/google`. |
| `MEMEX_URL` | `http://localhost:8080` | Use the port shown by `docker compose ps`; this may be `http://localhost:18080` locally. |
| `MEMEX_API_KEY` | `dev-agent-key` | Docker compose development API key. |
| `MEMEX_USER_ID` | `example_vercel_ai_service_user` | Stable namespace for this example's memory. |

## Run

From `examples/vercel-ai-service`:

```bash
MEMEX_URL=http://localhost:18080 bun run remember
MEMEX_URL=http://localhost:18080 bun run recall
```

You can also pass a custom durable preference:

```bash
MEMEX_URL=http://localhost:18080 bun run remember -- "I prefer tea in a blue mug before standup."
MEMEX_URL=http://localhost:18080 bun run recall
```

Expected output includes the tool calls and the remembered value:

```text
command: remember
memex_url: http://localhost:18080
memex_user_id: example_vercel_ai_service_user
tools: memory_memorize

I've remembered that you prefer ceramic pour-over coffee with oat milk before writing code.
```

```text
command: recall
memex_url: http://localhost:18080
memex_user_id: example_vercel_ai_service_user
tools: memory_search

Your coffee preference is ceramic pour-over coffee with oat milk before writing code.
```

## Inspect Memory

Confirm the service is healthy:

```bash
curl http://localhost:18080/health
```

List memory files for this example through the service API:

```bash
curl -sS -X POST http://localhost:18080/v1/tools/memory_list/execute \
  -H 'Authorization: Bearer dev-agent-key' \
  -H 'Content-Type: application/json' \
  -d '{"context":{"userId":"example_vercel_ai_service_user","actor":"manual-inspection"},"arguments":{"prefix":"user/"}}'
```

Open the admin UI at the published service URL, for example:

```text
http://localhost:18080/admin
```

Use the compose development admin secret `dev-admin-secret`, then filter files or revisions for `example_vercel_ai_service_user`.

## Why Agentic Tools

This example uses `memory_memorize` and `memory_search` instead of raw file tools because terminal examples should demonstrate the default agent workflow: the model supplies conversational text, and MemexAI decides which memory files to read, write, or patch. Raw tools such as `memory_write`, `memory_patch`, and `memory_read` are better when your application owns the file layout and wants exact path-level control.

The `remember` command is deliberately shaped like a post-turn memorize pass. In a real assistant, you would usually answer the user first, then run a focused follow-up turn that extracts durable facts and calls `memory_memorize`.
