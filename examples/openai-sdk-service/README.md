# MemexAI + OpenAI SDK Service Example

This example is a tiny TypeScript terminal app that uses the MemexAI container service through `@memexai/sdk` and the OpenAI TypeScript SDK. It calls Gemini through Google's OpenAI-compatible Chat Completions endpoint.

The CLI runs two turns:

1. Remember a durable preference with `memory_memorize`.
2. Recall it with `memory_search`.

## Setup

From the repository root, give the MemexAI service a model key. The CLI uses `GEMINI_API_KEY`, and the service also needs it because `memory_memorize` and memory subagent `memory_search` run inside the container:

```bash
cp .env.example .env
# Edit .env and add:
# GEMINI_API_KEY=...
# MEMEX_LLM_PROVIDER=google
```

Start the MemexAI service stack:

```bash
docker compose up -d
docker compose ps
```

Docker Compose usually exposes the API and admin UI on `http://localhost:8080`. If `docker compose ps` shows a different published port, set `MEMEX_URL` to that URL.

Install the example dependencies:

```bash
bun install
bun run build:sdk
cd examples/openai-sdk-service
cp .env.example .env
npm install
```

Edit `examples/openai-sdk-service/.env` and set `GEMINI_API_KEY`. Do not commit `.env`.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | required | Google AI Studio key used by the OpenAI SDK. |
| `MEMEX_URL` | `http://localhost:8080` | MemexAI service URL. Check `docker compose ps` if the port differs. |
| `MEMEX_API_KEY` | `dev-agent-key` | Agent API key for service routes. |
| `MEMEX_USER_ID` | `openai-sdk-service-demo-user` | Stable memory namespace for this demo user. |
| `OPENAI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` | Gemini OpenAI-compatible endpoint. |
| `OPENAI_MODEL` | `gemini-2.5-flash` | Gemini model name passed through the OpenAI SDK. |

If the service was already running before `GEMINI_API_KEY` was added to the repository root `.env`, recreate the service container:

```bash
docker compose up -d --force-recreate memexai
```

## Run

Check the service before running the model:

```bash
curl -s "$MEMEX_URL/health"
curl -s -H "Authorization: Bearer $MEMEX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"context":{"userId":"openai-sdk-service-demo-user","actor":"smoke"},"arguments":{"prefix":"user/"}}' \
  "$MEMEX_URL/v1/tools/memory_list/execute"
```

Run the two-turn CLI:

```bash
npm run start -- "I prefer 2BHK apartments."
```

Expected output is similar to:

```text
MemexAI service: http://localhost:8080
MemexAI user: openai-sdk-service-demo-user
Model: gemini-2.5-flash

Turn 1 - remember
User: Remember this durable preference: I prefer 2BHK apartments.
Assistant: Remembered: you prefer 2BHK apartments.

Turn 2 - recall
User: What apartment size do I prefer? Answer from memory only.
Assistant: You prefer 2BHK apartments.
```

## Inspect Memory

Use the service API:

```bash
curl -s -H "Authorization: Bearer $MEMEX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"context":{"userId":"openai-sdk-service-demo-user","actor":"smoke"},"arguments":{"query":"apartment size preference","prefix":"user/"}}' \
  "$MEMEX_URL/v1/tools/memory_search/execute"
```

Or open the admin UI at `http://localhost:8080/admin` and use the Docker default admin secret:

```text
dev-admin-secret
```

## Type Check

```bash
npm run typecheck
```

## Rationale

This stays in MemexAI service mode: the example never imports `@memexai/core`, never opens a Postgres connection, and never runs migrations. The service owns the database and exposes memory tools over HTTP.

The MemexAI OpenAI adapter provides tool definitions plus an `execute` helper. The current adapter definition shape is flat, while Chat Completions expects function tools as `{ type: "function", function: { ... } }`, so this example nests the adapter definitions locally before sending them to the OpenAI SDK. Tool execution still goes through the adapter.

Gemini is configured through the OpenAI SDK by setting `baseURL` to Google's OpenAI-compatible endpoint and using `GEMINI_API_KEY`. The code also fills in missing tool call IDs if a compatibility endpoint omits them, then uses those IDs consistently in the assistant and tool messages.
