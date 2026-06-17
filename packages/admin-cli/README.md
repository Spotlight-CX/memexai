# @memexai/admin

Admin CLI for [MemexAI](https://memexai.space) — inspect agent memory, revision history, access logs, and manage shared memory.

## Coding agent setup

If you are a coding agent onboarding a developer's project, read the full setup guide first:

```
https://memexai.space/setup.md
```

## Quick start

```bash
npx @memexai/admin init
```

The `init` command introspects the codebase, proposes a memory plan, writes `compose.yml` if missing (using `soorajshankar/memexai:latest`), starts Docker, bootstraps shared memory, and prints SDK wiring instructions.

Use `--yes` to skip interactive prompts (CI or agent mode).

## Without npx

If `npx` is unavailable, the Docker image bundles `memex-admin`:

```bash
# 1. Create compose.yml (see https://memexai.space/setup.md for full content)
# 2. Start the stack
docker compose up -d

# 3. Run init inside the container
docker exec $(docker compose ps -q memexai) memex-admin init --yes \
  --service-url http://localhost:8080 \
  --admin-secret dev-admin-secret
```

## Shared memory CI/CD

After `init`, commit `.memexai/shared/` and push it on every deploy:

```bash
npx @memexai/admin \
  --service-url $MEMEX_SERVICE_URL \
  --admin-secret $MEMEX_ADMIN_SECRET \
  shared push --from ./.memexai/shared/
```

## Other commands

```
memex-admin --help
memex-admin files list --prefix shared/
memex-admin files get shared/procedural.md
memex-admin setup status
memex-admin shared pull
memex-admin shared push --dry-run
```

Full docs: https://memexai.space/docs
