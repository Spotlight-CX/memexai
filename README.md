# MemexAI

Persistent memory for AI agents, backed by Postgres.

Agents forget because most memory lives in chat history, prompt glue, or app-specific tables that no one can inspect. MemexAI gives agents a small memory surface and gives humans a real system of record: files, search, revisions, access logs, and an admin UI.

No vector database required. No hidden memory blob. Just Postgres.

## What It Solves

AI agents need stable context:

- A user says they prefer quiet neighborhoods, and the next session should know.
- A support agent learns a durable account fact, and the team should audit when it changed.
- A product assistant needs shared company context and private per-user memory.
- A developer should be able to inspect memory without reverse-engineering model state.

MemexAI stores memory as scoped Markdown-like files in Postgres. Agents can use a simple two-tool interface, while advanced workflows can use raw file tools directly.

## Two Integration Paths

### Agentic Tools: The Default

Use this for most assistants. The model gets two tools and MemexAI handles the file bookkeeping.

```ts
const tools = memory.createAgenticToolset()
// memory_memorize, memory_search
```

- `memory_memorize` extracts durable facts and writes or patches memory.
- `memory_search` recalls relevant memory. Without a model, it falls back to Postgres full-text search. With a configured model, it resolves over memory files and returns grounded answers with sources.

### Raw Tools: Explicit File Control

Use this when your agent or app should manage memory files directly.

```ts
const tools = memory.createRawToolset()
// memory_list, memory_read, memory_write, memory_patch, memory_smart_read
```

- `memory_list` lists visible files.
- `memory_read` reads one file.
- `memory_write` creates or overwrites a user file.
- `memory_patch` appends under a heading or replaces exact text.
- `memory_smart_read` builds a bounded context block from visible files.

Both paths use the same scoped paths, revision history, and access logs.

## Quick Start: Docker Service

The service path is the best default for teams and production apps. Your app talks to an HTTP API; it never needs database credentials.

Create a `compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: memexai
      POSTGRES_PASSWORD: memexai
      POSTGRES_DB: memexai
    volumes:
      - memexai_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U memexai"]
      interval: 5s
      timeout: 5s
      retries: 5

  memexai:
    image: soorajsanker/memexai:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://memexai:memexai@postgres:5432/memexai
      MEMEX_API_KEY: dev-agent-key
      MEMEX_ADMIN_SECRET: dev-admin-secret
      GEMINI_API_KEY: ...     # RECOMMENDED — enables LLM-backed memory_memorize / memory_search
      # OPENAI_API_KEY: ...
    ports:
      - "8080:8080"

volumes:
  memexai_postgres_data:
```

Then:

```bash
docker compose up -d
# API and admin UI: http://localhost:8080
# API key:          dev-agent-key
# Admin secret:     dev-admin-secret

npm install @memexai/sdk ai @ai-sdk/google
```

```ts
import { MemexAI } from "@memexai/sdk"
import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

const memex = new MemexAI({
  url: "http://localhost:8080",
  apiKey: process.env.MEMEX_API_KEY ?? "dev-agent-key",
})

const memory = memex.forUser({ userId: "user_123", actor: "assistant" })

const result = await generateText({
  model: createGoogleGenerativeAI()("gemini-2.5-flash"),
  system: "You are a helpful assistant with durable memory.",
  prompt: "Remember that I prefer quiet neighborhoods near good schools.",
  tools: memory.createAgenticToolset(),
  stopWhen: stepCountIs(5),
})

console.log(result.text)
```

In HTTP mode, the SDK constructor stays simple:

```ts
new MemexAI({ url, apiKey })
```

LLM-backed `memory_memorize` and agentic `memory_search` are configured on the service/container, not in the SDK. Set one of these in the service environment:

```bash
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

# or
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

Without a service model, `memory_search` still works through Postgres full-text search. `memory_memorize` returns `MODEL_NOT_CONFIGURED`.

Open the admin UI at `http://localhost:8080/admin`.

## Quick Start: Direct Postgres

Use direct mode when your app already owns Postgres or you want no HTTP service. The model is part of the local MemexAI container because agentic memory runs in your process.

```bash
npm install @memexai/core ai @ai-sdk/google
```

```ts
import { createMemex } from "@memexai/core"
import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

const google = createGoogleGenerativeAI()

const memex = createMemex({
  databaseUrl: process.env.DATABASE_URL!,
  model: google("gemini-2.5-flash"),
})

await memex.migrate()

const memory = memex.forUser({ userId: "user_123", actor: "assistant" })

const result = await generateText({
  model: google("gemini-2.5-flash"),
  system: "You are a helpful assistant with durable memory.",
  prompt: "Remember that I prefer quiet neighborhoods near good schools.",
  tools: memory.createAgenticToolset(),
  stopWhen: stepCountIs(5),
})

console.log(result.text)

await memex.end()
```

Inspect direct-mode memory with the local admin CLI:

```bash
npx @memexai/admin --database-url postgresql://...
# Opens http://localhost:4040/admin
```

## Tool Adapters

The instance methods are the clearest path:

```ts
const agenticTools = memory.createAgenticToolset()
const rawTools = memory.createRawToolset()
```

The Vercel AI adapter is available for compatibility in both packages:

```ts
import { createVercelAITools } from "@memexai/sdk/adapters/vercel-ai"
// or "@memexai/core/adapters/vercel-ai" for direct Postgres mode

const agenticTools = createVercelAITools(memory)
const rawTools = createVercelAITools(memory, { mode: "raw" })
```

Other adapters:

```ts
import { createAnthropicTools, handleAnthropicToolCall } from "@memexai/core/adapters/anthropic"
import { createLangChainTools } from "@memexai/core/adapters/langchain"
import { createOpenAITools } from "@memexai/sdk/adapters/openai"
```

Raw MCP-style execution is also available:

```ts
const tools = memex.getTools()

await memex.executeTool("memory_write", {
  path: "user/profile.md",
  content: "# Profile\n\n- Prefers quiet neighborhoods.",
  reason: "captured user preference",
}, {
  userId: "user_123",
  actor: "assistant",
})
```

## Memory Model

Memory is stored as files in Postgres tables:

- `mx_file` stores the current file content.
- `mx_revision` stores every write snapshot with actor, reason, and tool call ID.
- `mx_access_log` stores every read, write, patch, search, and smart-read touch.

Agents see virtual paths:

```text
user/profile.md  -> users/{userId}/profile.md
user/notes.md    -> users/{userId}/notes.md
shared/index.md  -> shared/index.md
```

The `user/` prefix is translated from the scoped context you create:

```ts
const memory = memex.forUser({ userId: "user_123", actor: "assistant" })
```

The model never receives raw physical paths like `users/user_123/...`, and it cannot escape into another user's memory by guessing an ID. See [docs/scopes.md](docs/scopes.md).

## Admin UI

Docker includes the admin UI at:

```text
http://localhost:8080/admin
```

Direct Postgres mode can use:

```bash
npx @memexai/admin --database-url postgresql://...
```

The admin UI shows:

- Files as a tree, with full content.
- Revision history for each write.
- Access logs for reads, searches, writes, and patches.
- Users derived from scoped memory paths.

## Why Postgres Instead Of A Vector Store?

Most durable agent memory is not a nearest-neighbor problem. It is structured recall:

- What does this user prefer?
- What has the agent already learned?
- Which shared file explains this workflow?
- What changed, and who changed it?

Postgres gives MemexAI durable storage, full-text search, migrations, access control boundaries, and audit tables in one place. BM25 is enough for deterministic candidate discovery. When a model is configured, MemexAI can resolve over memory files agentically, with bounded reads and cited source paths.

Embeddings can be useful for some retrieval workloads. They are not required for the default memory loop.

## Comparison

|  | mem0 OSS | Zep | MemexAI |
|---|---|---|---|
| Default storage | Vector/KV stack | Managed graph memory | Postgres |
| Agent surface | Automatic extraction APIs | Platform memory APIs | Two tools by default |
| Raw file control | Limited | Limited | First-class |
| Revision history | Not the default | Not self-hosted by default | Built in |
| Access logs | Not the default | Platform dependent | Built in |
| Self-hosting | Requires more infra | Cloud-first | One Postgres-backed service |
| Admin UI | Not core OSS | Managed | Self-hosted |

The goal is not to be a bigger memory platform. The goal is a smaller, inspectable memory layer that agents can use and humans can trust.

## Examples

Direct Postgres examples:

```bash
cd examples/vercel-ai
DATABASE_URL=postgresql://... GEMINI_API_KEY=... bun run start "Remember I prefer 2BHK apartments"

cd ../anthropic
DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=... bun run start "Remember I prefer 2BHK apartments"
```

HTTP service demo agent (requires cloning the repo):

```bash
docker compose up -d

MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
GEMINI_API_KEY=... \
bun run demo:agent -- "Remember that I prefer quiet neighborhoods"
```

Smoke test without an LLM:

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
bun run demo:agent -- --smoke
```

## Deeper Topics

- [docs/architecture.md](docs/architecture.md) - system architecture and tool flow.
- [docs/scopes.md](docs/scopes.md) - `user/` and `shared/` path translation.
- [docs/revisions.md](docs/revisions.md) - revision history.
- [docs/access-logs.md](docs/access-logs.md) - access logging.
- [docs/migrations.md](docs/migrations.md) - schema migrations.
- [docs/publishing.md](docs/publishing.md) - release and publish workflow.

## Status

Early stage. The core loop works: Postgres-backed files, scoped agent tools, BM25 search, model-backed memorize/search, revisions, access logs, SDKs, and admin UI.

Feedback and issues are welcome.
