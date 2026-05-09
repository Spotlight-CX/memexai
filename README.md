# MemexAI

Persistent memory service for AI agents, with a REST API, TypeScript SDK, framework adapters, Docker service, and admin dashboard.

## Quick Start

```bash
bun install --registry=https://registry.npmmirror.com
docker compose up -d

MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
bun run demo:agent -- --smoke
```

Open `http://localhost:8080/admin` and use `dev-admin-secret` to inspect `demo_user` under Users, Files, Revisions, and Access Logs.

If you create a local `.env`, Docker Compose will use those values instead of the defaults in `compose.yml`. Use the same `MEMEX_API_KEY` when running `bun run demo:agent`.

## Services

- `memexai`: Fastify API and admin UI on `http://localhost:8080`
- `postgres`: Postgres exposed on `localhost:5433`

## Environment

```bash
PORT=8080
DATABASE_URL=postgresql://memexai:memexai@postgres:5432/memexai
MEMEX_API_KEY=dev-agent-key
MEMEX_ADMIN_SECRET=dev-admin-secret
```

For the live Vercel AI SDK demo agent, also set:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
MEMEX_DEMO_USER_ID=demo_user
```

## Demo Agent

Smoke test without OpenAI:

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
bun run demo:agent -- --smoke
```

Live agent:

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
OPENAI_API_KEY=sk-... \
bun run demo:agent -- "Remember that I prefer quiet projects near good schools"
```

## Development

```bash
bun run build
bun run test
```
