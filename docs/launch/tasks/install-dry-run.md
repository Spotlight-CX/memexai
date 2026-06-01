# Verify End-to-End Docker Install Path
**Priority:** P0
**Type:** code
**Status:** [ ] not started

## What
Run the full Docker install path as a first-time user would: `docker compose up -d` → write a memory via demo agent → open admin UI → verify the file is visible → check revision exists → check access log entry. Fix any broken step. The 90-second proof only works if the actual path is smooth. If anything breaks, fix it before marking done.

## Files
- `docker-compose.yml` — verify services start clean
- `apps/demo-agent/` — run demo agent to write a memory
- `apps/service/` — admin UI must be reachable and show the written file

## Steps
1. `docker compose down -v && docker compose up -d` (clean start)
2. Wait for health: `curl http://localhost:8080/health`
3. `bun run demo:agent -- "Remember I prefer quiet neighborhoods near good schools"`
4. Open `http://localhost:8080/admin` → Files → verify `user/*/profile.md` or similar exists with the written content
5. Click the file → verify revision history shows 1 entry
6. Check access logs → verify a write entry appears
7. Run a second demo agent call with a different preference → verify the file updates and revision count is now 2

## Done when
- Full path completes in under 2 minutes with no errors
- Admin UI shows the written file with content matching the agent input
- Revision history shows entries
- Access log shows entries
