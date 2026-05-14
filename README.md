# memexai

Agent memory on Postgres. No vector store needed.

Two ways to use it:

| | With Docker (recommended) | Direct Postgres |
|---|---|---|
| **Package** | `@memexai/sdk` | `@memexai/core` |
| **How it connects** | HTTP API | Direct `pg` connection |
| **Runs what** | Docker: Postgres + HTTP service + admin | Just your app + Postgres |
| **Best for** | Teams, production, microservices | Solo, serverless, embedded |

---

## Flow 1 — With Docker (recommended)

The Docker image runs Postgres, the HTTP memory service, and the admin UI together. Your app never touches Postgres directly — it talks to the HTTP API.

```bash
# 1. Start everything
docker compose up -d
# Postgres on 5433, memory API + admin at http://localhost:8080

# 2. Install the HTTP client SDK
npm install @memexai/sdk
```

```ts
import { MemexAI } from "@memexai/sdk"
import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

const memex = new MemexAI({
  url: "http://localhost:8080",   // or your deployed service URL
  apiKey: process.env.MEMEX_API_KEY,
})

const user = memex.forUser({ userId: "user_123", actor: "assistant" })
const promptBlock = await user.getPromptBlock()

const { text } = await generateText({
  model: createGoogleGenerativeAI()("gemini-2.5-flash"),
  system: `You are a helpful assistant.\n\n${promptBlock}`,
  prompt: "Remember that I prefer quiet neighborhoods near good schools.",
  tools: user.createAgenticToolset(),
  stopWhen: stepCountIs(5),
})
```

Admin UI is already included at `http://localhost:8080/admin`.

**Why this is the recommended path for most teams:** your application servers never need database credentials. The memory service is a single deploy target. Multiple apps or services can share the same memory namespace without any coordination.

---

## Flow 2 — Direct Postgres (no container)

`@memexai/core` connects directly to Postgres using `pg`. No HTTP service, no auth layer, no Docker. Call `migrate()` once and you're ready.

```bash
npm install @memexai/core
```

```ts
import { createMemex } from "@memexai/core"
import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

// Connect to any Postgres — local, Neon, Supabase, RDS
const google = createGoogleGenerativeAI()
const memex = createMemex({
  databaseUrl: process.env.DATABASE_URL,
  model: google("gemini-2.5-flash"),
})
await memex.migrate()  // idempotent: safe to call on every startup

const user = memex.forUser({ userId: "user_123", actor: "assistant" })
const promptBlock = await user.getPromptBlock()

const { text } = await generateText({
  model: google("gemini-2.5-flash"),
  system: `You are a helpful assistant.\n\n${promptBlock}`,
  prompt: "Remember that I prefer quiet neighborhoods near good schools.",
  tools: user.createAgenticToolset(),
  stopWhen: stepCountIs(5),
})

await memex.end()  // closes the connection pool when done
```

Then inspect memory without writing SQL:

```bash
npx @memexai/admin --database-url postgresql://...
# Opens http://localhost:4040/admin
```

**Why you'd pick this:** no service to deploy or maintain. Works in serverless (Neon/Supabase handle pooling). Good for hobby projects, single-process apps, or embedding memory into an existing service that already owns a DB.

---

## Why not a vector store?

- **Most agent memory is structured reads, not fuzzy search.** Profile fields, preferences, and session notes are looked up by path. A filesystem beats a vector index for this — it's predictable, auditable, and fast.
- **Vector stores are extra infra.** Qdrant, Chroma, Pinecone — each is another service to run, auth, and keep in sync. If you already have Postgres, you have everything memexai needs.
- **Revision history is free.** Every write creates a revision row. You get a complete audit trail — who wrote what, when, and why — with no extra work.

---

## Memory model

Memory is stored as files in Postgres tables (`mx_file`, `mx_revision`, `mx_access_log`). Paths use a two-level namespace:

```
user/profile.md        → users/{userId}/profile.md  (private to this user)
user/notes.md          → users/{userId}/notes.md
shared/index.md        → shared/index.md             (readable by all users)
```

The `user/` prefix is always translated to `users/{userId}/` using the `userId` from your tool context. Agents never see raw physical paths. See [docs/scopes.md](docs/scopes.md) for details.

Agents use four tools:

| Tool | What it does |
|---|---|
| `memory_memorize` | Remember durable facts while memexai handles file bookkeeping |
| `memory_search` | Retrieve relevant memory, using BM25 or agentic resolution when configured |
| `memory_smart_read` | Read a merged memory context block under a character budget |
| `memory_list` | List files the agent can see (both user/ and shared/) |
| `memory_read` | Read a file by virtual path |
| `memory_write` | Create or overwrite a user/ file |
| `memory_patch` | Append lines under a heading or replace exact text |

For most agents, pass `user.createAgenticToolset()` and expose only `memory_memorize` and `memory_search`. Use `user.createRawToolset()` when you want the model to manage files directly.

Every write records a revision with actor, reason, and tool call ID.

---

## Framework adapters

**Vercel AI SDK**

```ts
import { createVercelAITools } from "@memexai/core/adapters/vercel-ai"
// or from "@memexai/sdk/adapters/vercel-ai" for the HTTP client

const tools = createVercelAITools(user)
// Pass to generateText(), streamText(), etc.
```

**Anthropic SDK**

```ts
import { createAnthropicTools, handleAnthropicToolCall } from "@memexai/core/adapters/anthropic"

const tools = createAnthropicTools(user)
// In your tool-use loop:
await handleAnthropicToolCall(block.name, block.input, user)
```

**LangChain**

```ts
import { createLangChainTools } from "@memexai/core/adapters/langchain"
const tools = createLangChainTools(user)
```

**MCP / raw JSON Schema**

```ts
// getTools() returns raw MCP-compatible tool definitions
const tools = memex.getTools()

// executeTool() runs any tool directly
await memex.executeTool("memory_write", {
  path: "user/notes.md",
  content: "...",
  reason: "captured preference"
}, { userId: "user_123", actor: "assistant" })
```

---

## Admin UI

```bash
# npx (no install) — direct Postgres
npx @memexai/admin --database-url postgresql://...
# --port 4040 (default)
# --no-open  (skip browser auto-open)

# Docker — admin is at http://localhost:8080/admin (no extra install)
```

The admin UI shows:

- Memory files as a tree, with full content
- Revision history: actor, reason, tool call ID, timestamp
- Access logs: every read, write, and patch
- User list with file counts

---

## Comparison

|  | mem0 OSS | Zep | **memexai** |
|---|---|---|---|
| Storage | Vector + KV (needs Qdrant/Chroma) | Graph (Graphiti) | **Postgres only** |
| Memory model | Automatic extraction, embeddings | Temporal knowledge graph | **Agent-controlled files** |
| Revision history | ❌ | ❌ | **✅** |
| Admin UI | ❌ | ✅ cloud only | **✅ self-hosted** |
| Self-hosted | ✅ (with vector DB) | ❌ | **✅ just Postgres** |
| Install | `npm install mem0ai` | managed | **`npm install @memexai/core`** |

Zep killed their self-hosted community edition. mem0 OSS still needs a vector store. Neither gives agents a free-form filesystem with history.

---

## Running examples

```bash
git clone https://github.com/soorajshankar/memexai.git
cd memexai

# Vercel AI SDK — direct Postgres
cd examples/vercel-ai
DATABASE_URL=postgresql://... GEMINI_API_KEY=... bun run start "Remember I prefer 2BHK apartments"

# Anthropic SDK — direct Postgres
cd examples/anthropic
DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=... bun run start "Remember I prefer 2BHK apartments"

# Demo agent — HTTP service (needs docker compose up first)
MEMEX_URL=http://localhost:8080 MEMEX_API_KEY=dev-agent-key GEMINI_API_KEY=... \
  bun run demo:agent -- "Remember that I prefer quiet neighborhoods"

# Demo agent — direct Postgres (--direct flag)
DATABASE_URL=postgresql://memexai:memexai@localhost:5433/memexai GEMINI_API_KEY=... \
  bun run demo:agent -- --direct "Remember that I prefer quiet neighborhoods"
```

---

## Deeper topics

- [docs/architecture.md](docs/architecture.md) — System architecture, container vs direct, tool call flow
- [docs/scopes.md](docs/scopes.md) — user/ vs shared/ scopes, implicit path translation
- [docs/revisions.md](docs/revisions.md) — What revision history records and why
- [docs/access-logs.md](docs/access-logs.md) — What access logs capture and how to use them
- [docs/migrations.md](docs/migrations.md) — How schema migrations work, adding new ones

---

## Status

Early stage. The core loop works. Feedback and issues welcome.
