# @memexai/sdk

TypeScript SDK for the MemexAI HTTP service.

Use it when your app talks to a running MemexAI service or container. The SDK stays model-free: LLM configuration belongs to the service environment.

## Install

```bash
npm install @memexai/sdk
```

## Basic Usage

```ts
import { MemexAI } from "@memexai/sdk"

const memex = new MemexAI({
  url: "http://localhost:8080",
  apiKey: "dev-agent-key",
})

const memory = memex.forUser({
  userId: "demo_user",
  actor: "assistant",
})

const result = await memory.search("What does this user prefer?")
console.log(result.answer ?? result.results)
```

`memory.search()` falls back to Postgres full-text search when the service has no model configured. `memory.memorize()` requires a service-side model and returns `MODEL_NOT_CONFIGURED` when none is available.

## Agentic Toolset

Use this for most agents. MemexAI handles memory file bookkeeping.

```ts
import { generateText, stepCountIs } from "ai"

const result = await generateText({
  model,
  system: "You are a helpful assistant with durable memory.",
  prompt: "Remember that I prefer quiet projects near good schools.",
  tools: memory.createAgenticToolset(),
  stopWhen: stepCountIs(5),
})

console.log(result.text)
```

Exposes:

```ts
// memory_memorize, memory_search
```

## Raw File Toolset

Use raw mode when you want the agent or app to manage memory files explicitly.

```ts
const tools = memory.createRawToolset()
// memory_list, memory_read, memory_write, memory_patch, memory_smart_read
```

You can also call raw file methods directly:

```ts
await memory.writeFile({
  path: "user/profile.md",
  content: "# Profile\n\n- Prefers quiet projects near good schools.",
  reason: "captured user preference",
})

const file = await memory.readFile({ path: "user/profile.md" })
console.log(file.content)
```

## Vercel AI Adapter

```ts
import { createVercelAITools } from "@memexai/sdk/adapters/vercel-ai"

const agenticTools = createVercelAITools(memory)
const rawTools = createVercelAITools(memory, { mode: "raw" })
```

## Other Adapters

The SDK also exports:

- `@memexai/sdk/adapters/openai`
- `@memexai/sdk/adapters/langchain`

Use `@memexai/core` for direct Postgres mode and core-only adapters.

## Links

- Repository: https://github.com/Spotlight-CX/memexai
- Root README: deployment, admin UI, direct Postgres mode, and architecture.
