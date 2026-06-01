# Positioning

Last updated: 2026-05-26

---

## The Underlying Bet (Deepest Layer)

> "Human taste is now more important than ever as codegen tools make everyone a 10x engineer."
> — Leo Paz (Outlit, W25)

Leo said this about engineers. The insight is universal.

AI can now act at near-zero marginal cost. The bottleneck is no longer capability — it's knowing *whose* taste to apply. Not just for engineers. For every person using an AI product: their preferences, their friction points, their identity, their voice. All taste. AI currently ignores it, session after session.

MemexAI's bet: the AI products that win will be the ones whose next response changes because they genuinely know their users. Not via a vector store over chat logs. Via a maintained, inspectable model of who each user is that gets injected into the next model call and that the AI can read, update, and reason about.

When AI knows your taste, it can do more than answer questions. It can reduce the decisions you need to make.

---

## Core Narrative

MemexAI gives B2C AI products taste memory — a persistent, inspectable model of who each user is that can influence the next response across every session. Not storage for its own sake. Not a vector store. A structured memory workbench the AI can read, revise, and reason about.

**The problem it solves:** AI products churn users not because they lack features, but because the AI starts fresh every session. Users feel like a stranger to a product they've used for months.

**The insight:** Existing memory tools (Mem0, Zep, Letta) treat memory as a retrieval problem — embed facts, search, inject. That solves "what did the user say?" not "who is this user?" Taste memory requires structured files the agent can navigate, update, and reason about as a whole — not a search engine over facts.

---

## One-Liners

**Primary (B2C retention angle):**
> "Your AI forgets who your users are between sessions. MemexAI fixes that."

**Technical (architecture angle):**
> "Memory that changes the next AI response: prompt-block context, structured files in Postgres, revisions, no GPU required."

**Differentiation (vs vector stores):**
> "Not another vector store. Memory files your AI can read, write, and reason about — in the database you already have."

**Taste memory angle:**
> "The difference between an AI that feels generic and one that feels like it genuinely knows you: taste memory."

---

## Category Language

- Not "AI memory retrieval" — that's Mem0/Zep/Letta's category
- Not "agent context persistence" — that's coding-agent tools (Engram, Wire Memory)
- **Our category: "user taste memory for B2C AI products"**

When writing content: use "taste memory", "persistent personalization", "user memory layer" — not "vector retrieval", "embedding", or "RAG".

---

## Competitor Contrasts

| Tool | What it optimizes for | MemexAI's contrast |
|---|---|---|
| Mem0 | Retrieval accuracy (49% recall), GPU infra | No GPU, no embeddings, plain SQL, inspectable |
| Zep | Token efficiency (600K context), graph extraction | No graph complexity, Postgres-native, self-hostable |
| Letta | Benchmark accuracy (83%), stateful agents | No token burn per memory op, 4 simple tools |
| Wire Memory | Claude Code session persistence (coding agents) | Scoped to user, not session; B2C products, not dev tooling |
| OpenAI Assistants | Platform-managed threads | OSS, self-hosted, model-agnostic, inspectable admin |
| Engram | Coding-agent memory (Go + SQLite) | Multi-user, Postgres, HTTP API, B2C personalization |

**Blocking claim (do not use):** Do not claim specific benchmark numbers for MemexAI — we haven't run the benchmarks. Position on architecture and use-case fit, not accuracy stats.

---

## Proof Points (Real, Today)

- Postgres-native: one table (`mx_file`), full-text search via tsvector GIN — no embedding infra
- Prompt-block injection: `getSystemPrompt()` / `getPromptBlock()` puts stored memory back into the next model call
- Revisioned writes: `mx_revision` gives full audit trail per memory update — admin can see before/after per session
- Dual mode: embed directly (`@memexai/core`) or run the HTTP service (`@memexai/sdk`) — works with Vercel AI SDK, Anthropic SDK, LangChain, and OpenAI-style tools
- Self-hostable: Docker Compose, Postgres on 5433, API + admin UI on 8080
- Admin UI: inspect, edit, and version user memories without writing SQL
- Playground: test `memory_memorize` and `memory_search` in the browser with dry runs, user scope switching, timelines, and raw tool escape hatches
- Python SDK: service-mode Python client and adapters exist for Python-heavy AI stacks
- MCP: SSE and stdio transports expose the same memory engine to MCP clients

**Proof points we want but don't have yet:**
- "A B2C company using MemexAI reported X% retention improvement" — this is the assignment (see experiments.md)
- Public walkthrough video showing Docker -> Playground -> revision trail in under 5 minutes

---

## Messaging by Audience

### For B2C AI founders (primary)
Lead with: user churn, session-reset problem, "feels generic"
Hook: "Your users explain their situation again every session. Your AI starts fresh. That's why they stop coming back."
CTA: "See how taste memory works → [link]"

### For developers integrating MemexAI
Lead with: simplicity, no exotic infra, Postgres-native
Hook: "4 tools. One Postgres table. Embed directly or run the HTTP service."
CTA: "Read the README → [link]"

### For B2C founders evaluating vs competitors
Lead with: inspectability and self-hosting
Hook: "Mem0 and Zep give your AI a search engine. MemexAI gives it a workbench it can reason about."
CTA: "See the architecture → [link]"
