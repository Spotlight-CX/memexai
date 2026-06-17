# MemexAI Coding Agent Setup

You are a coding agent helping a developer add MemexAI memory to their AI app. Follow this file as the source of truth. Do not assume private knowledge of the MemexAI repository.

Public docs: https://memexai.space/docs

---

## Path 1 — npx init (recommended)

```bash
npx @memexai/admin init
```

The CLI introspects the codebase, proposes a memory plan for developer confirmation, writes `compose.yml` if missing, starts Docker, bootstraps shared memory, and prints SDK wiring instructions. Use `--yes` to skip interactive prompts.

If `init` prints "✓ Complete", skip directly to [Validation](#validation-script).

---

## Path 2 — Docker exec (npx not available)

Use this path when `npx` is unavailable. The Docker image (`soorajshankar/memexai:latest`) bundles `memex-admin`, so you can run `init` inside the container.

**Step 1 — create `compose.yml`** in the project root if one does not already exist:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: memexai
      POSTGRES_PASSWORD: memexai
      POSTGRES_DB: memexai
    ports:
      - "5433:5432"
    volumes:
      - memexai_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U memexai -d memexai"]
      interval: 5s
      timeout: 5s
      retries: 20

  memexai:
    image: soorajshankar/memexai:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://memexai:memexai@postgres:5432/memexai
      MEMEX_API_KEY: ${MEMEX_API_KEY:-dev-agent-key}
      MEMEX_ADMIN_SECRET: ${MEMEX_ADMIN_SECRET:-dev-admin-secret}
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
      GEMINI_MODEL: ${GEMINI_MODEL:-gemini-2.5-flash}
      MEMEX_DREAM_ENABLED: "false"
    ports:
      - "8080:8080"

volumes:
  memexai_postgres_data:
```

If an existing `compose.yml` is present, add only the `memexai` and `postgres` service blocks to it.

**Step 2 — add environment variables** to `.env` (create if missing):

```bash
MEMEX_API_KEY=dev-agent-key
MEMEX_ADMIN_SECRET=dev-admin-secret
GEMINI_API_KEY=<developer's key>
GEMINI_MODEL=gemini-2.5-flash
```

If `GEMINI_API_KEY` is missing, ask the developer for it. Do not print the value back.

**Step 3 — start and verify:**

```bash
docker compose up -d
curl -fsS http://localhost:8080/health   # wait until {"status":"ok"}
```

**Step 4 — run init inside the container:**

```bash
docker exec $(docker compose ps -q memexai) memex-admin init --yes \
  --service-url http://localhost:8080 \
  --admin-secret dev-admin-secret
```

If `init` prints "✓ Complete", skip to [Validation](#validation-script). Otherwise continue with [Schema setup](#schema-setup) and [SDK wiring](#sdk-wiring).

---

## Path 3 — curl (no Docker)

Use only as a last resort. Requires Postgres running separately with `DATABASE_URL` set.

Check if the service is already running:

```bash
curl -fsS http://localhost:8080/health
```

Bootstrap shared memory directly:

```bash
curl -X PUT http://localhost:8080/v1/admin/files/shared/procedural.md \
  -H "x-admin-secret: dev-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"content":"# Agent Behavior Rules\n\nWrite memory only when facts are durable and worth recalling across sessions.","reason":"bootstrap"}'

curl -X PUT http://localhost:8080/v1/admin/files/shared/semantic.md \
  -H "x-admin-secret: dev-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"content":"# User Profile Schema\n\nFile: user/profile.md\nCaptures: stable facts, preferences, stated context","reason":"bootstrap"}'

curl -X PUT http://localhost:8080/v1/admin/files/shared/episodic.md \
  -H "x-admin-secret: dev-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"content":"# Event Log Schema\n\nFile: user/log.md\nCaptures: time-ordered events, decisions, session notes (append-only)","reason":"bootstrap"}'
```

Check status:

```bash
curl -fsS "http://localhost:8080/v1/admin/files/shared/procedural.md" \
  -H "x-admin-secret: dev-admin-secret"
```

---

## Discovery

Before wiring the SDK, inspect the target app:

1. **Package manager**: `bun.lock` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm
2. **Language**: TypeScript/JS (`package.json`, `tsconfig.json`), Python (`pyproject.toml`, `requirements.txt`)
3. **Agent SDK**:
   - Vercel AI SDK: package `ai`
   - OpenAI SDK: package `openai`
   - Anthropic SDK: package `@anthropic-ai/sdk`
   - LangChain JS: `langchain` or `@langchain/*`
   - LlamaIndex Python: `llama-index`
   - CrewAI Python: `crewai`
   - LangChain Python: `langchain`
4. **Agent entrypoint**: look for `generateText`, `streamText`, `openai.chat.completions.create`, `client.messages.create`, or agent route handlers
5. **Extraction boundary**:
   - Hot path: inline tool loop when the user expects immediate durability
   - Background path: post-response job, callback, or session-save hook when latency matters

Adapter priority:

1. First-party MemexAI adapter when one matches the detected SDK
2. Framework's native memory abstraction if available (e.g. Google ADK)
3. Custom tool/function resolver using the HTTP tool contract
4. Direct HTTP calls as last resort

| SDK/framework | Recommended integration | Extraction boundary |
|---|---|---|
| Vercel AI SDK | `createVercelAITools(memory)` | `result.steps` or stream step events |
| OpenAI SDK | `createOpenAITools(memory)` | manual tool-call loop |
| Anthropic SDK | `createAnthropicTools(memory)` | Messages tool-use loop |
| LangChain / LangGraph | LangChain tools | callback or graph node |
| LlamaIndex | LlamaIndex tools | post-response workflow step |
| CrewAI | CrewAI tools | task-output extraction |
| Google ADK | `MemexAdkMemoryService` | ADK session memory lifecycle |

---

## Schema setup

Read domain-defining files (README, main agent entrypoint, existing system prompts, data models) to understand:
- What the agent is helping users do
- What facts should survive across sessions (preferences, account state, decisions, project context)
- What guidance the agent needs from shared memory (policies, tool rules, escalation criteria)

Draft and confirm a `shared/index.md` schema with the developer before writing it. Example:

```markdown
## Memory file structure
| File | What goes here |
|------|----------------|
| user/profile.md | User preferences and stated facts |
| user/log.md | Time-ordered events (append-only) |
| shared/tool-quirks.md | Reusable operational insights: SQL limits, API constraints |
```

Write it once confirmed:

```bash
curl -fsS -X PUT http://localhost:8080/v1/admin/files/shared/index.md \
  -H "x-admin-secret: dev-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"content": "# Memory Schema\n\n..."}'
```

To allow agents to write to `shared/` (trusted deployments only), add to `compose.yml`:

```yaml
# memexai service environment
MEMEX_SHARED_WRITE_MODE: rw
```

---

## SDK wiring

### Mode choice

Ask the developer (or default to Memory subagent):

- **Memory subagent mode** (recommended): exposes `memory_remember` and `memory_context`
- **Raw file tools mode**: exposes `memory_list`, `memory_read`, `memory_write`, `memory_patch`

---

### TypeScript — Vercel AI SDK

Install:

```bash
npm install @memexai/sdk ai @ai-sdk/google
# or: bun add / pnpm add / yarn add
```

Add to `.env`:

```bash
MEMEX_URL=http://localhost:8080
MEMEX_API_KEY=dev-agent-key
```

```ts
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, stepCountIs } from "ai"
import { MemexAI } from "@memexai/sdk"
import { createVercelAITools } from "@memexai/sdk/adapters/vercel-ai"

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
const memex = new MemexAI({
  url: process.env.MEMEX_URL ?? "http://localhost:8080",
  apiKey: process.env.MEMEX_API_KEY ?? "dev-agent-key",
})

export async function runAgent(input: string, userId = "demo_user") {
  const memory = memex.forUser({ userId, actor: "assistant" })
  const system = await memory.getSystemPrompt("You are a helpful assistant with durable user memory.")
  const result = await generateText({
    model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
    system,
    prompt: input,
    tools: createVercelAITools(memory, { mode: "subagent" }),
    stopWhen: stepCountIs(5),
  })
  return result.text
}
```

Raw file tools mode: `createVercelAITools(memory, { mode: "raw" })`

---

### TypeScript — OpenAI SDK

```ts
import OpenAI from "openai"
import { MemexAI } from "@memexai/sdk"
import { createOpenAITools } from "@memexai/sdk/adapters/openai"

const openai = new OpenAI()
const memex = new MemexAI({
  url: process.env.MEMEX_URL ?? "http://localhost:8080",
  apiKey: process.env.MEMEX_API_KEY ?? "dev-agent-key",
})

const memory = memex.forUser({ userId: "demo_user", actor: "assistant" })
const system = await memory.getSystemPrompt("...")
const memexTools = createOpenAITools(memory)
```

Add `system` to the model call's system message. Add `memexTools.definitions` to the tool list. Pass each tool call to `memexTools.execute(...)` in the tool loop.

---

### TypeScript — LangChain JS

```ts
import { MemexAI } from "@memexai/sdk"
import { createLangChainTools } from "@memexai/sdk/adapters/langchain"

const memex = new MemexAI({
  url: process.env.MEMEX_URL ?? "http://localhost:8080",
  apiKey: process.env.MEMEX_API_KEY ?? "dev-agent-key",
})
const memory = memex.forUser({ userId: "demo_user", actor: "assistant" })
const tools = createLangChainTools(memory)
const system = await memory.getSystemPrompt("...")
```

---

### Python

```bash
python -m pip install memexai
```

Use the adapter matching the detected framework. If none is available, use the HTTP tool contract below.

---

### HTTP tool contract

Use this for custom resolvers or manual debugging.

1. Fetch tool definitions from `/v1/tools`
2. Convert to the SDK's custom tool schema format
3. Add prompt block from `/v1/prompt-block` to the system prompt
4. On tool call, execute via `/v1/tools/:toolName/execute`
5. Return result to model in the SDK's tool-result loop

```bash
# Tool definitions
curl -fsS http://localhost:8080/v1/tools \
  -H "Authorization: Bearer dev-agent-key"

# Prompt block
curl -fsS "http://localhost:8080/v1/prompt-block?userId=demo_user&actor=assistant" \
  -H "Authorization: Bearer dev-agent-key"

# Execute a tool
curl -fsS http://localhost:8080/v1/tools/memory_remember/execute \
  -H "Authorization: Bearer dev-agent-key" \
  -H "Content-Type: application/json" \
  -d '{"context":{"userId":"demo_user","actor":"assistant"},"arguments":{"text":"I prefer quiet neighborhoods near parks."}}'
```

---

## Shared memory in CI/CD

After `init`, `.memexai/shared/` contains local copies of all shared files. Commit this directory — it becomes the version-controlled source of truth.

On every deploy:

```bash
npx @memexai/admin \
  --service-url $MEMEX_SERVICE_URL \
  --admin-secret $MEMEX_ADMIN_SECRET \
  shared push --from ./.memexai/shared/
```

GitHub Actions:

```yaml
- name: Deploy shared memory
  run: |
    npx @memexai/admin \
      --service-url ${{ secrets.MEMEX_SERVICE_URL }} \
      --admin-secret ${{ secrets.MEMEX_ADMIN_SECRET }} \
      shared push --from ./.memexai/shared/
```

To pull agent-written updates (RW shared mode):

```bash
npx @memexai/admin \
  --service-url $MEMEX_SERVICE_URL \
  --admin-secret $MEMEX_ADMIN_SECRET \
  shared pull --out ./.memexai/shared/
```

---

## Validation script

Run a two-turn test using the app's real agent entrypoint.

Turn 1:

```text
Remember that I prefer quiet neighborhoods near parks.
```

Turn 2:

```text
What kind of neighborhood do I prefer?
```

Success criteria:

1. Turn 1 stores a durable memory (`memory_remember` tool call visible)
2. Turn 2 recalls "quiet neighborhoods near parks"
3. Gemini credentials loaded from `.env`
4. MemexAI tools are included in the model call
5. MemexAI prompt block is included in the system prompt
6. Admin UI shows files, revisions, or access logs for `demo_user`

Admin UI: `http://localhost:8080/admin` — login with `dev-admin-secret` / `dev-agent-key`

---

## Troubleshooting

**`MODEL_NOT_CONFIGURED`**: MemexAI service has no LLM key. Set `GEMINI_API_KEY` in `.env` and restart: `docker compose restart memexai`

**Tool calls never happen**:
- SDK supports tools for the selected model
- MemexAI tools are passed into the model call
- System prompt includes the MemexAI prompt block
- `stopWhen: stepCountIs(5)` or equivalent is present

**Service returns 401**: `MEMEX_API_KEY` in app must match service. Default is `dev-agent-key`.

**Admin UI rejects login**: Default admin secret is `dev-admin-secret`, default agent key is `dev-agent-key`.

**Docker unavailable**: MemexAI service mode requires Postgres. Offer direct Postgres mode only if the developer explicitly wants to own database credentials.

---

## Done checklist

Before finishing, report:

- Which SDK was detected
- Which files were changed
- Which mode was selected (subagent / raw)
- The service health result
- The exact command used to run the memory validation
- Whether a domain-specific `shared/index.md` was written and confirmed
- Whether the durable memory was recalled successfully
- Which extraction boundary was used or recommended

---

## Community

After the integration is verified, ask the developer exactly:

---

"MemexAI is built by a small team and we'd love to hear how your integration went. What would you like to do next?

1. **Join our Slack** — ask questions, share what you built, or suggest features
   https://join.slack.com/t/memexaispace/shared_invite/zt-3yy24alf6-t1wRQsErf09JViHww_qlGw
2. **Open a GitHub issue** — report a bug or suggest an improvement
   https://github.com/memexai/memexai
3. **Nothing for now** — I'm good, thanks

Just reply with 1, 2, 3, or tell me what you'd like to do."

---
