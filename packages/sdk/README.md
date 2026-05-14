# @memexai/sdk

TypeScript SDK for MemexAI, a persistent memory service for AI agents.

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

await memory.memorize("Prefers quiet projects near good schools")

const result = await memory.search("What project style does this user prefer?")
console.log(result.answer ?? result.results)
```

## Vercel AI SDK Adapter

```ts
import { generateText, stepCountIs } from "ai"

const promptBlock = await memory.getPromptBlock()

const result = await generateText({
  model,
  system: [
    "You are a helpful agent with durable memory.",
    "Use memory tools when the user asks you to remember, retrieve, or update stable preferences.",
    "",
    promptBlock,
  ].join("\n"),
  prompt: "Remember that I prefer quiet projects near good schools.",
  tools: memory.createAgenticToolset(),
  stopWhen: stepCountIs(5),
})

console.log(result.text)
```

## Raw File Toolset

Use raw mode when you want the agent to manage memory files explicitly:

```ts
const tools = memory.createRawToolset()
// memory_list, memory_read, memory_write, memory_patch, memory_smart_read
```

## Tool Adapters

The SDK exports adapters for:

- `@memexai/sdk/adapters/vercel-ai`
- `@memexai/sdk/adapters/openai`
- `@memexai/sdk/adapters/langchain`

## Links

- Repository: https://github.com/soorajshankar/memexai
- Admin dashboard and local service instructions are in the root README.
