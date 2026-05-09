# MemexAI Demo Agent

This is a tiny CLI agent that demonstrates the MemexAI TypeScript SDK, the Vercel AI SDK adapter, and the Docker service.

## Start MemexAI

```bash
docker compose up -d
```

The default compose setup exposes:

- API and admin UI: `http://localhost:8080`
- Demo API key: `dev-agent-key`
- Admin secret: `dev-admin-secret`

## Smoke Test Without OpenAI

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
bun run demo:agent -- --smoke
```

This verifies service auth, writes `user/demo-agent.md`, reads it back, and prints the admin URL.

Open `http://localhost:8080/admin`, enter `dev-admin-secret`, and inspect `demo_user` in Users, Files, Revisions, and Access Logs.

## Live Agent

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
GEMINI_API_KEY=... \
bun run demo:agent -- "Remember that I prefer quiet projects near good schools"
```

Optional environment variables:

- `GEMINI_MODEL`, default `gemini-2.5-flash`
- `OPENAI_API_KEY` and `OPENAI_MODEL`, fallback provider when no Gemini key is set
- `MEMEX_DEMO_USER_ID`, default `demo_user`

The live agent fetches the Memex prompt block, gives the model Memex memory tools, and allows up to five Vercel AI SDK tool steps.
