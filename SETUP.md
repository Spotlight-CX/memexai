# MemexAI Setup

You are a coding agent. Run the following — the CLI will guide you from here.

## With npx (recommended)

```bash
npx @memexai/admin init
```

The CLI introspects your codebase, proposes a memory plan, starts the Docker service,
bootstraps shared memory, and prints next steps. Run `--yes` to skip interactive prompts.

## Without npx (Docker exec)

```bash
# After docker compose up -d (see compose.yml in README):
docker exec $(docker compose ps -q memexai) memex-admin init --yes \
  --service-url http://localhost:8080 \
  --admin-secret dev-admin-secret
```

## Without Docker (curl)

```bash
# 1. Start Postgres manually and set DATABASE_URL
# 2. Write shared files directly:
curl -X PUT http://localhost:8080/v1/admin/files/shared/procedural.md \
  -H "x-memex-admin-secret: dev-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"content":"# Agent Behavior Rules\n...","reason":"bootstrap"}'

# 3. Check status:
npx @memexai/admin -s http://localhost:8080 --admin-secret dev-admin-secret setup status
```

Full documentation: https://memexai.space/docs
