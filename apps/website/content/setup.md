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

If no supported SDK is found, use the raw HTTP fallback section.

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
      MEMEX_DREAM_ENABLED: "true"
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
  const memexPrompt = await memory.getPromptBlock()

  const result = await generateText({
    model: google(process.env.GEMINI_MODEL ?? "gemini-2.5-flash"),
    system: [
      "You are a helpful assistant with durable user memory.",
      memexPrompt,
    ].join("\n\n"),
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
const memexPrompt = await memory.getPromptBlock()
const memexTools = createOpenAITools(memory)
```

Add `memexPrompt` to the system message. Add `memexTools.definitions` to the OpenAI tool list. When the model returns tool calls, pass each call to `memexTools.execute(...)` and continue the tool loop according to the app's existing OpenAI SDK pattern.

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
const memexPrompt = await memory.getPromptBlock()
```

Add `memexPrompt` to the system prompt and bind `tools` using the app's existing LangChain tool binding pattern.

## Python setup

For Python projects, install:

```bash
python -m pip install memexai
```

Use the adapter that matches the detected framework if present. If no framework adapter is available, use the HTTP fallback below.

## Raw HTTP fallback

Use this if the app's agent SDK is unknown.

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
- Whether the durable memory was recalled successfully.
