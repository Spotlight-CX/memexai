# memexai

Agent memory on Postgres. No vector store needed.

```bash
npm install @memexai/core
```

---

## Quickstart

```ts
import { createMemex } from "@memexai/core"
import { createVercelAITools } from "@memexai/core/adapters/vercel-ai"
import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

// 1. Connect to your existing Postgres
const memex = createMemex(process.env.DATABASE_URL)
await memex.migrate()  // creates tables on first run

// 2. Scope to a user
const user = memex.forUser({ userId: "user_123", actor: "assistant" })
const promptBlock = await user.getPromptBlock()

// 3. Wire memory tools into your agent
const { text } = await generateText({
  model: createGoogleGenerativeAI()("gemini-2.5-flash"),
  system: `You are a helpful assistant.\n\n${promptBlock}`,
  prompt: "Remember that I prefer quiet neighborhoods near good schools.",
  tools: createVercelAITools(user),
  stopWhen: stepCountIs(5),
})

console.log(text)
// Agent reads and writes memory automatically.
// Open the admin UI to see what it stored.
```

```bash
npx memex-admin --database-url postgresql://...
# Opens http://localhost:4040/admin
```

---

## Why not a vector store?

- **Most agent memory is structured reads, not fuzzy search.** Profile fields, preferences, and session notes are looked up by path, not semantically queried. A filesystem beats a vector index for this.
- **Vector stores are extra infra.** Qdrant, Chroma, Pinecone — each one is another service to run, auth, and keep in sync. If you already have Postgres, you have everything memexai needs.
- **Revision history is free.** Every write creates a revision row. You get a complete audit trail — who wrote what, when, and why — with no extra work.

---

## How it works

Memory is stored as files in Postgres:

```
users/{userId}/profile.md    ← agent writes here via user/**
users/{userId}/notes.md
shared/index.md              ← read-only, shared context
```

Agents use four tools:

| Tool | What it does |
|---|---|
| `memory_list` | List files the agent can see |
| `memory_read` | Read a file by path |
| `memory_write` | Create or overwrite a user file |
| `memory_patch` | Append under a heading or replace exact text |

Every write records a revision with the actor, reason, and tool call ID. The admin UI makes this inspectable without touching SQL.

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

## Framework adapters

**Vercel AI SDK**

```ts
import { createVercelAITools } from "@memexai/core/adapters/vercel-ai"

const tools = createVercelAITools(user)
// Pass to generateText(), streamText(), etc.
```

**Anthropic SDK**

```ts
import { createAnthropicTools, handleAnthropicToolCall } from "@memexai/core/adapters/anthropic"

const tools = createAnthropicTools(user)
// Pass to client.messages.create({ tools })
// Then: await handleAnthropicToolCall(block.name, block.input, user)
```

**LangChain**

```ts
import { createLangChainTools } from "@memexai/core/adapters/langchain"

const tools = createLangChainTools(user)
```

**MCP / any other SDK**

```ts
// getTools() returns raw JSON Schema tool definitions
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
npx memex-admin --database-url postgresql://...
# --port 4040 (default)
# --no-open  (skip auto-opening browser)
```

The admin UI shows:

- Memory as a file tree
- Full file content
- Revision history with actor, reason, and tool call ID
- Access logs (reads, writes, patches)
- All users and their file counts

---

## Running examples

```bash
# Clone the repo
git clone https://github.com/soorajshankar/memexai.git
cd memexai

# Vercel AI SDK example
cd examples/vercel-ai
DATABASE_URL=postgresql://... GEMINI_API_KEY=... bun run start "Remember I prefer 2BHK apartments"

# Anthropic SDK example
cd examples/anthropic
DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=... bun run start "Remember I prefer 2BHK apartments"
```

---

## Running the service (existing HTTP API)

If you prefer an HTTP service rather than direct Postgres:

```bash
docker compose up -d
# API + admin at http://localhost:8080
# Postgres at localhost:5433
```

See [apps/service](apps/service) and [packages/sdk](packages/sdk) for the HTTP SDK.

---

## Status

Early stage. The core loop works. Feedback and issues welcome.
