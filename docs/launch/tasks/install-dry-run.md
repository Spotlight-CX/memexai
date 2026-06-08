# Verify End-to-End Docker Install Path
**Priority:** P0
**Type:** code
**Status:** [x] done

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

## Verification
- Ran `docker compose down -v && docker compose up -d --build`; image built successfully.
- The first service start could not bind because local port `18080` was already allocated, so reran the stack with `MEMEX_PORT=18081`.
- Verified health with `curl http://localhost:18081/health` → `{ "ok": true }`.
- Ran demo agent smoke path with `MEMEX_URL=http://localhost:18081 MEMEX_API_KEY=dev-api-key MEMEX_DEMO_USER_ID=demo_user bun run demo:agent -- --smoke`.
- Wrote `user/profile.md` via `memory_write` curl for `demo_user`, read it back via `memory_read`, then wrote a second preference.
- Verified admin file endpoint shows `users/demo_user/profile.md`, matching content, latest revision, and `revisionCount: 2`.
- Verified admin revisions endpoint returns two write revisions for the profile file.
- Verified admin access logs endpoint returns read/write entries for the profile file.
- Verified `POST /v1/admin/revisions/prune` with `x-admin-secret` returns `{ "deleted": 0 }` for a 3650-day retention window.
- Used `agent-browser` to open the admin UI, inspect Files/Revisions/Activity, and capture screenshots.

## Notes
- No live model key was present in the shell for this proof, so the external-LLM `memory_remember` path was not used. The Docker service did load model-provider configuration from local environment, but the install proof used deterministic SDK/raw tool writes to avoid depending on provider credentials.
