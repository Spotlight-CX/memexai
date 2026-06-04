# MemexAI Coding Agent Setup

You are a coding agent helping a developer add MemexAI memory to their AI app. Follow this file as the source of truth. Do not assume private knowledge of the MemexAI repository.

Public docs:
- Website: https://memexai.space
- Human guide: https://memexai.space/docs/quickstart/agent-onboarding
- Docker service guide: https://memexai.space/docs/quickstart/docker-service
- Memory tools: https://memexai.space/docs/concepts/memory-tools
- Shared memory: https://memexai.space/docs/concepts/shared-memory

## Goal

Wire MemexAI into the developer's agent so it can:

1. Start or connect to a local MemexAI service.
2. Use a stable user id for memory.
3. Add MemexAI tools to the model call.
4. Add the MemexAI prompt block/system prompt section.
5. Store a durable memory.
6. Recall that memory in a later call.

## First questions to ask

Ask these before editing code:

1. "Do you want recommended Agent mode, or advanced Raw tool mode?"
   - Recommend Agent mode.
   - Agent mode exposes `memory_memorize` and `memory_search`.
   - Raw tool mode exposes lower-level file tools such as `memory_list`, `memory_read`, `memory_write`, and `memory_patch`.
2. "Should I set up a local Docker Compose MemexAI service for this project?"
   - Recommend yes for local development.
   - If Docker is already running, verify it instead of restarting it.

If the user does not choose, proceed with Agent mode and local Docker Compose.

## Discovery

Inspect the target app before changing it:

1. Identify package manager:
   - `bun.lock` -> bun
   - `pnpm-lock.yaml` -> pnpm
   - `yarn.lock` -> yarn
   - `package-lock.json` -> npm
2. Identify runtime and language:
   - TypeScript/JavaScript package: inspect `package.json`, `tsconfig.json`, source files.
   - Python package: inspect `pyproject.toml`, `requirements.txt`, source files.
3. Identify agent SDK from dependencies and imports:
   - Vercel AI SDK: package `ai`
   - OpenAI SDK: package `openai`
   - Anthropic SDK: package `@anthropic-ai/sdk`
   - LangChain JS: packages containing `langchain` or `@langchain/*`
   - LlamaIndex Python: package `llama-index`
   - CrewAI Python: package `crewai`
   - LangChain Python: package `langchain`
4. Find the agent entrypoint:
   - Look for `generateText`, `streamText`, `openai.chat.completions.create`, `client.messages.create`, agent route handlers, or scripts that call the model.

Adapter priority:

1. Use a first-party MemexAI adapter when one matches the detected SDK.
2. If no adapter exists, keep the app's existing language/model SDK and wire MemexAI through that SDK's custom tool/function resolver API.
3. Use direct HTTP calls only as the last reserve: manual debugging, validation scripts, or apps with no usable tool-calling abstraction.

The HTTP tool contract section below is the low-level wire contract that custom resolvers call behind the scenes.

## Local service setup

MemexAI service mode is the recommended local development path. It gives the app an HTTP memory service, Postgres storage, and the admin UI.

Check whether the service is already running:

```bash
curl -fsS http://localhost:8080/health
```

If healthy, keep it running and continue.

If not healthy, check `.env`. The local service needs:

```bash
MEMEX_API_KEY=dev-agent-key
MEMEX_ADMIN_SECRET=dev-admin-secret
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

If `GEMINI_API_KEY` is missing, ask the developer for it or ask them to place it in `.env`. Do not print the secret back to the user.

Add or reuse a `compose.yml` service using the MemexAI Docker image:

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

Start it:

```bash
docker compose up -d
curl -fsS http://localhost:8080/health
```

After it is healthy, open:

```text
http://localhost:8080/admin?defaultAdminSecret=1&defaultApiKey=1&onboarding=1
```

If the app does not yet support the default-login query params, open `http://localhost:8080/admin` and use:

```text
Admin secret: dev-admin-secret
Agent API key: dev-agent-key
```

## Schema setup

After the service is healthy, inspect the target app to understand what kind of durable memory the product needs.

1. Read domain-defining files: README, main agent entrypoint, existing system prompts, data models. Identify:
   - What the agent is helping users do
   - What facts should survive across sessions (preferences, account state, decisions, project context)
   - What guidance the agent needs from shared memory (policies, tool rules, escalation criteria)

2. Draft a `shared/index.md` that describes:
   - Memory file conventions (e.g. `user/preferences.md`, `user/project-state.md`)
   - What the agent should memorize and what it should skip
   - Domain-specific schema and formatting guidelines

3. Show the draft to the developer. Ask them to confirm or adjust the proposed schema before writing it.

4. Once confirmed, write it to shared memory:

```bash
curl -fsS -X PUT http://localhost:8080/v1/admin/files/shared/index.md \
  -H "x-admin-secret: dev-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{"content": "# Memory Schema\n\n..."}'
```

Or write directly via the admin UI Files tab at `http://localhost:8080/admin`.

5. Verify it was saved:

```bash
curl -fsS "http://localhost:8080/v1/admin/files/shared/index.md" \
  -H "x-admin-secret: dev-admin-secret"
```

This schema is injected into every agent's system prompt automatically via `getSystemPrompt()`. Agents read the shared guidance before they decide what to memorize.

## Explain the integration to the developer

Before the final handoff, explain the setup in two layers.

TLDR:

1. Docker runs Postgres plus the MemexAI HTTP service.
2. The app sends memory tool calls to the service with `MEMEX_API_KEY`.
3. The agent gets two recommended tools: `memory_memorize` and `memory_search`.
4. The app must include `memory.getSystemPrompt(...)` on every model call so stored memory affects later answers.
5. The admin UI shows the files, revisions, access logs, and tool activity behind the behavior.

Under the hood:

1. Agent tools use virtual paths such as `user/profile.md`.
2. MemexAI validates each path and translates `user/...` to `users/{userId}/...`.
3. Writes update `mx_file`, create full snapshots in `mx_revision`, and create read/write rows in `mx_access_log`.
4. Shared memory such as `shared/index.md` is injected into the prompt block and guides every agent.
5. User memory becomes useful on the next turn only when the prompt block is included and the same stable `userId` is used.

## TypeScript setup

Install packages based on the detected package manager.

```bash
npm install @memexai/sdk ai @ai-sdk/google
```

Use the equivalent `bun add`, `pnpm add`, or `yarn add` if the project uses that package manager.

Add environment variables for the app:

```bash
MEMEX_URL=http://localhost:8080
MEMEX_API_KEY=dev-agent-key
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Use the developer's existing Gemini env vars if already present.

## Vercel AI SDK adapter

For projects using the Vercel AI SDK package `ai`, use this shape.

Agent mode:

```ts
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText, stepCountIs } from "ai"
import { MemexAI } from "@memexai/sdk"
import { createVercelAITools } from "@memexai/sdk/adapters/vercel-ai"

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

const memex = new MemexAI({
  url: process.env.MEMEX_URL ?? "http://localhost:8080",
  apiKey: process.env.MEMEX_API_KEY ?? "dev-agent-key",
})

export async function runAgent(input: string, userId = "demo_user") {
  const memory = memex.forUser({ userId, actor: "assistant" })
  const system = await memory.getSystemPrompt(
    "You are a helpful assistant with durable user memory.",
  )

  const result = await generateText({
    model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
    system,
    prompt: input,
    tools: createVercelAITools(memory, { mode: "agentic" }),
    stopWhen: stepCountIs(5),
  })

  return result.text
}
```

Raw tool mode:

```ts
tools: createVercelAITools(memory, { mode: "raw" })
```

Prefer Agent mode unless the developer explicitly asked for raw file-level control.

## OpenAI SDK adapter

For projects using `openai`, use `@memexai/sdk/adapters/openai`.

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

Add `system` to the model call's system message. Add `memexTools.definitions` to the OpenAI tool list. When the model returns tool calls, pass each call to `memexTools.execute(...)` and continue the tool loop according to the app's existing OpenAI SDK pattern.

## LangChain JS adapter

For LangChain JS projects, use:

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

Add `system` to the model call and bind `tools` using the app's existing LangChain tool binding pattern.

## Python setup

For Python projects, install:

```bash
python -m pip install memexai
```

Use the adapter that matches the detected framework if present. If no framework adapter is available, keep the app's Python agent SDK and wire MemexAI as custom tools using the HTTP tool contract below.

## HTTP tool contract

This is the low-level MemexAI contract. Prefer first-party adapters. If no adapter exists, use this contract inside the app's existing SDK-native custom tool resolver. Use direct HTTP calls only as the last reserve.

1. Fetch MemexAI tool definitions from `/v1/tools`.
2. Convert the selected MemexAI tools into the SDK's custom tool/function schema format.
3. Add the prompt block from `/v1/prompt-block` to the system prompt.
4. When the model emits a tool call, execute it through `/v1/tools/:toolName/execute`.
5. Return the tool result to the model using the SDK's normal tool-result loop.

The curl examples below are for manual debugging and for runtimes that truly cannot expose SDK-native tools.

Get tool definitions:

```bash
curl -fsS http://localhost:8080/v1/tools \
  -H "Authorization: Bearer dev-agent-key"
```

Get prompt block:

```bash
curl -fsS "http://localhost:8080/v1/prompt-block?userId=demo_user&actor=assistant" \
  -H "Authorization: Bearer dev-agent-key"
```

Execute a tool:

```bash
curl -fsS http://localhost:8080/v1/tools/memory_memorize/execute \
  -H "Authorization: Bearer dev-agent-key" \
  -H "Content-Type: application/json" \
  -d '{"context":{"userId":"demo_user","actor":"assistant"},"arguments":{"text":"I prefer quiet neighborhoods near parks."}}'
```

Agent mode should expose only:

- `memory_memorize`
- `memory_search`

Raw tool mode may expose:

- `memory_list`
- `memory_read`
- `memory_write`
- `memory_patch`
- `memory_memorize`
- `memory_search`

## Validation script

After wiring, run a two-turn test. Use the app's real agent entrypoint if possible.

Turn 1:

```text
Remember that I prefer quiet neighborhoods near parks.
```

Turn 2:

```text
What kind of neighborhood do I prefer?
```

Success criteria:

1. The first turn stores a durable memory.
2. The second turn recalls quiet neighborhoods near parks.
3. The code uses Gemini credentials from `.env`.
4. The model call includes MemexAI tools.
5. The model call includes the MemexAI prompt block or equivalent system prompt section.
6. The admin UI shows files, revisions, or access logs for `demo_user`.

## Troubleshooting

If `memory_memorize` returns `MODEL_NOT_CONFIGURED`, the MemexAI service does not have an LLM key. Set `GEMINI_API_KEY` in the service environment and restart Docker Compose.

If tool calls never happen, confirm:

- The SDK supports tools for the selected model.
- The MemexAI tools are passed into the model call.
- The prompt includes the MemexAI prompt block.
- `stopWhen: stepCountIs(5)` or an equivalent tool-loop setting is present.

If the service returns 401:

- Confirm `MEMEX_API_KEY` in the app matches the service.
- Local default is `dev-agent-key`.

If the admin UI rejects login:

- Local default admin secret is `dev-admin-secret`.
- Local default agent API key is `dev-agent-key`.

If Docker is unavailable:

- Explain that MemexAI service mode needs Postgres and the HTTP service.
- Offer direct Postgres mode only if the developer explicitly wants to own database credentials in their app.

## Done checklist

Before finishing, report:

- Which SDK was detected.
- Which files were changed.
- Which mode was selected.
- The service health result.
- The exact command used to run the memory validation.
- Whether a domain-specific `shared/index.md` was written and confirmed with the developer.
- Whether the durable memory was recalled successfully.
