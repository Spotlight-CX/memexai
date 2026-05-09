# MemexAI V1 Subrepo Product Plan

## Summary
MemexAI lives inside `propx` as a nested git subrepo first. The first committed artifact is this plan file.

Initial shape:

```text
memexai/
  PRODUCT_PLAN.md
  package.json
  apps/
    service/
  packages/
    sdk/
```

First action:

```bash
mkdir memexai
cd memexai
git init
# add PRODUCT_PLAN.md
git add PRODUCT_PLAN.md
git commit -m "Add MemexAI product plan"
```

Runtime:
- One Docker service: `memexai`
- One Postgres service
- One exposed service port
- REST API at `/v1/...`
- Admin UI from same backend at `/admin`

## Locked Tech Stack
- Language: TypeScript, ESM
- Package manager/scripts: Bun
- Production runtime: Node.js running compiled JS
- Package build: `tsup`
- Backend: Fastify
- Database: Postgres via `pg`
- Migrations: plain SQL migrations owned by `apps/service`
- Runtime schemas: Zod
- Admin frontend: Vite + React
- Admin UI kit: Mantine
- Admin UI routing: single-page tabs, no router in v1
- Tests: Vitest only in v1
- SDK scope: TypeScript only
- API docs: no generated OpenAPI in v1

Deferred:
- Playwright/e2e tests
- Session storage
- Configurable mounts
- Schema validation
- Python SDK
- Generated API docs
- Admin mutation workflows

## Auth And Ports
Use one service port in v1.

Environment variables:
- `PORT`
- `DATABASE_URL`
- `MEMEX_API_KEY`
- `MEMEX_ADMIN_SECRET`

Agent/tool routes require:

```http
Authorization: Bearer <MEMEX_API_KEY>
```

Protected tool routes:
- `GET /v1/tools`
- `POST /v1/tools/:toolName/execute`
- `GET /v1/prompt-block`

Admin routes require:

```http
X-Memex-Admin-Secret: <MEMEX_ADMIN_SECRET>
```

Admin UI flow:
- `/admin` serves the static Vite app.
- UI asks for the admin secret on first load.
- UI stores it in browser `localStorage`.
- UI sends `X-Memex-Admin-Secret` to `/v1/admin/*`.
- UI includes "Forget secret".
- Production service refuses to start without `MEMEX_ADMIN_SECRET`.

## Memory Model
Hardcoded v1 mounts:
- `user/**`: writable agent memory
- `shared/**`: read-only shared/product memory

No first-class folders. Files are rows with slash-delimited paths; folder views are derived from prefixes.

Mapping:
- Agent sees `user/profile.md`
- Admin sees `users/user_123/profile.md`
- Agent sees `shared/claude.md`
- Admin sees `shared/claude.md`

Rules:
- Agents can create any file under `user/**`.
- Agents cannot write under `shared/**`.
- Agents never see physical `users/{userId}` paths.
- Reject `../`, absolute paths, empty segments, and physical root paths.
- No `create_folder` tool.

## Milestones
### Milestone 0: Subrepo Foundation - Done
Tasks:
- Create `memexai/` nested git repo.
- Add this plan as `PRODUCT_PLAN.md`.
- Commit only the plan as first commit.

Testable outcomes:
- `cd memexai && git log --oneline` shows the plan commit.
- `cd memexai && git status` is clean.
- Parent repo does not absorb subrepo internals.

Parallelization:
- Must happen first.

### Milestone 1: Service And Storage - Done
Tasks:
- Create `apps/service`.
- Add Fastify service skeleton.
- Add SQL migrations for files, revisions, access logs.
- Add migration runner.
- Add Zod request schemas.
- Add API key auth middleware.
- Add admin secret middleware.
- Implement path translation and safety.
- Implement `memory_list`, `memory_read`, `memory_write`, `memory_patch`.
- Implement `/v1/tools`, `/v1/tools/:toolName/execute`, `/v1/prompt-block`.

Testable outcomes:
- Service starts locally against Postgres.
- Migrations run from service code.
- `user/**` writes succeed.
- `shared/**` writes fail.
- Unsafe paths fail.
- Reads/writes create logs and revisions.
- Tool routes reject invalid API key.

Parallelization:
- Schema, auth middleware, and path utilities can be built in parallel.
- Tool execution waits for path utilities.
- Integration tests wait for migrations.

### Milestone 2: TypeScript SDK - Done
Tasks:
- Create `packages/sdk`.
- Add `new MemexAI({ url, apiKey })`.
- Add `forUser({ userId, actor })`.
- Add `getPromptBlock`, `listFiles`, `readFile`, `writeFile`, `patchFile`.
- Preserve machine-readable service errors.
- Build package with `tsup`.

Testable outcomes:
- SDK calls REST only.
- SDK sends bearer API key.
- Missing `userId` fails before user-scoped writes.
- Errors like `READ_ONLY_MOUNT` are preserved.

Parallelization:
- SDK can start once endpoint contracts are stubbed.
- Mocked HTTP tests can run before service integration.

### Milestone 3: Tool Adapters - Done
Tasks:
- Add Vercel AI SDK adapter.
- Add OpenAI adapter.
- Add LangChain adapter after first two stabilize.
- Pass `toolCallId` when available.

Testable outcomes:
- Adapter schemas match service tool schemas.
- Executions go through SDK methods.
- Tool call IDs appear in access logs/revisions.
- Minimal Vercel and OpenAI examples work.

Parallelization:
- Vercel and OpenAI adapters can be parallel after SDK signatures stabilize.
- LangChain waits.

### Milestone 4: Embedded Admin UI - Done
Tasks:
- Build Vite React admin app with Mantine.
- Use single-page tabs: Users, Files, Revisions, Access Logs.
- Add admin secret entry screen.
- Store secret in `localStorage`.
- Add "Forget secret".
- Add users list.
- Add derived file tree and preview.
- Add revision diff view.
- Add access log table.
- Serve built admin assets from Fastify at `/admin`.

Testable outcomes:
- `/admin` loads from same service as `/v1`.
- Admin API rejects invalid secret.
- UI can browse `users/{userId}/...` and `shared/...`.
- UI has no edit/delete/rollback/approve controls.
- Revision diff shows tool writes and patches.

Parallelization:
- UI can start against mocked data.
- Admin API waits for storage schema.
- Real integration waits for admin API.

### Milestone 5: Docker Product - Done
Tasks:
- Add Dockerfile using Node runtime for compiled output.
- Add compose file with `memexai` and `postgres`.
- Validate required env vars.
- Run migrations on startup or via explicit command.
- Serve API and admin UI from one process.

Testable outcomes:
- `docker compose up` starts both services.
- `/v1/tools` responds with valid API key.
- `/admin` loads.
- `/v1/admin/*` rejects invalid admin secret.
- Data persists across restarts.

Parallelization:
- Dockerfile can start once service boot exists.
- Final validation waits for service, admin, and SDK.

### Milestone 6: Propx Integration - Done
Tasks:
- Add MemexAI URL/API key config to `propx`.
- Route memory operations through SDK.
- Inject `memory.getPromptBlock()` into chat system prompt.
- Keep existing Abodex behavior stable.

Testable outcomes:
- Abodex chat reads/writes through MemexAI.
- Existing profile-memory behavior still works.
- No direct MemexAI Postgres dependency from `propx`.
- Tool call IDs appear in MemexAI admin logs.
- Relevant chat tests pass or equivalent tests replace them.

Parallelization:
- Waits for service, SDK, and adapters.

## Minimal SDK Usage
```ts
import { MemexAI } from "@memexai/sdk"

const memex = new MemexAI({
  url: process.env.MEMEX_URL!,
  apiKey: process.env.MEMEX_API_KEY!,
})

const memory = memex.forUser({
  userId: "user_123",
  actor: "assistant",
})

const promptBlock = await memory.getPromptBlock()

await memory.writeFile({
  path: "user/profile.md",
  content: "# Profile\n\n- Budget: 2.5 Cr\n",
  reason: "Created initial buyer profile",
})

const profile = await memory.readFile({
  path: "user/profile.md",
})
```

## Tool Adapter Example
```ts
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { MemexAI } from "@memexai/sdk"
import { createVercelAITools } from "@memexai/sdk/adapters/vercel-ai"

const memex = new MemexAI({
  url: process.env.MEMEX_URL!,
  apiKey: process.env.MEMEX_API_KEY!,
})

const memory = memex.forUser({
  userId: "user_123",
  actor: "assistant",
})

const result = await generateText({
  model: openai("gpt-4.1"),
  system: `
You are a helpful assistant.

${await memory.getPromptBlock()}
`,
  prompt: "Remember that I prefer quieter projects near good schools.",
  tools: createVercelAITools(memory),
})
```

## Assumptions
- The first subrepo commit contains only `PRODUCT_PLAN.md`.
- Agents may choose file paths under allowed mounts, but not frameworks or architecture.
- Host app owns user identity and passes trusted user context to MemexAI.
- SDK, service, and admin UI are versioned together for v1.
