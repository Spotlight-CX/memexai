# memexai — Launch Plan

> Goal: OSS credibility, GitHub stars, developer community.  
> Constraint: Solo, full-time. Ship fast, cut scope aggressively.

---

## The Bet

Most agent memory tools (mem0, Zep) assume you need a vector store or a managed cloud. memexai bets the opposite: **structured markdown files in the Postgres you already have, with full revision history and an admin UI.**

No vector store. No separate infra. No cloud dependency. If you have Postgres, you're done.

---

## Competitive Position

| | mem0 OSS | Zep | memexai |
|---|---|---|---|
| Containerless | ✅ `npm install mem0ai/oss` | ❌ deprecated community edition | 🔲 needs SDK |
| Storage | Vector + KV (needs Qdrant/Chroma) | Graph (Graphiti) | Postgres only |
| Memory model | Automatic extraction, embeddings | Temporal knowledge graph | Agent-controlled files |
| Revision history | ❌ | ❌ | ✅ |
| Admin UI | ❌ | ✅ cloud only | ✅ self-hosted |
| Self-hosted | ✅ (with vector DB) | ❌ | ✅ just Postgres |

**The gap we fill:** Zep killed self-hosted. mem0 OSS still needs a vector store. Neither gives agents a free-form filesystem with history. That's the story.

**The angle that will land on HN:**  
*"We stopped using vector stores for agent memory. Here's what we built instead."*

Counter-narrative + concrete alternative = HN catnip.

---

## What Needs to Be Built Before Launch

### 1. `@memexai/core` — npm SDK (est. 3–5 days)

The heavy lifting already exists in the codebase. This is mostly extraction + packaging.

**What to extract:**
- `src/tools.ts` — `executeMemoryRead`, `executeMemoryWrite`, `executeMemoryPatch`, `executeMemoryList`
- `src/paths.ts` — virtual/physical path resolution
- `src/schemas.ts` — Zod tool schemas
- `src/migrations.ts` — `runMigrations()`
- `src/db.ts` — `createPool()`

**Target API:**
```ts
import { createMemex } from "@memexai/core"

const memex = createMemex("postgresql://...")
await memex.migrate()

// Returns MCP-compatible tool definitions
const tools = memex.getTools()

// Execute a tool (wires into any AI SDK)
await memex.executeTool("memory_write", {
  path: "user/notes.md",
  content: "...",
  reason: "captured preference"
}, { userId: "user_123", actor: "assistant" })
```

**What to NOT build yet:** file storage backend, multiple DB adapters, plugin system.

---

### 2. `npx memex-admin` — Local Admin UI (est. 2–3 days)

A CLI command that takes a Postgres URL and opens the existing admin dashboard locally. Proven pattern (Prisma Studio, Drizzle Kit Studio).

```bash
npx memex-admin --database-url postgresql://... --port 4040
```

This is the "wow" moment for devs who've integrated the SDK and want to see what their agents are actually storing. Pairs perfectly with the SDK.

**Scope:** just a thin CLI wrapper that serves the existing admin build — no new features.

---

### 3. README that converts (est. 1 day)

The README must get someone from zero to working in under 5 minutes. Structure:

1. **One sentence:** what it is
2. **The 15-line quickstart** — install, connect, run
3. **Why not vector stores** — 3 bullet points, links to longer explanation
4. **Admin UI gif** — the revision history view is genuinely impressive visually
5. **Comparison table** — vs mem0, vs Zep
6. **Framework adapters** — show it wiring into Vercel AI SDK, Anthropic SDK, LangChain

No architecture docs, no deep philosophy — that comes after stars.

---

### 4. Framework integration examples (est. 2 days)

The SDK only lands if people can see it working in their stack. Need two working examples:

- **Vercel AI SDK** — most common in the JS/TS agent world right now
- **Anthropic SDK / MCP** — natural fit, aligns with abodex.space architecture

Both as runnable repos in a `/examples` folder, not just code snippets.

---

## What to Skip (For Now)

- ❌ File storage backend — Postgres is free everywhere, not the real friction
- ❌ Cloud/hosted tier — premature, adds operational overhead, wrong goal right now
- ❌ Enterprise features — SSO, audit, RBAC
- ❌ Python SDK — do TypeScript first, Python later if HN traction is real
- ❌ Vector store adapter — doesn't fit the "just Postgres" narrative

---

## HN Launch Strategy

### Timing
Launch when: a stranger can get the SDK working in 15 minutes without asking a question. That's the bar. Not "mostly works" — zero-friction works.

### The Post
**Title options (test internally):**
- "Show HN: Agent memory on Postgres — no vector store needed"
- "Show HN: memexai — self-hosted memory for AI agents with revision history"
- "I stopped using vector stores for agent memory (Show HN)"

**Body must include:**
- What problem this solves (agent memory that persists, is inspectable, and doesn't require vector infra)
- The Zep gap (community edition deprecated, cloud-only now)
- A live demo GIF of the admin UI showing revision history
- The `npm install` one-liner
- Why markdown files beat embeddings for structured memory (this will get the most debate — good)

### What will get attacked
- "Isn't this just a filesystem?" → yes, intentionally. Agents should own their structure.
- "Vector search is better for retrieval" → for semantic search yes, but most agent memory is structured reads, not fuzzy search
- "mem0 already does this" → mem0 still needs Qdrant. We're just Postgres.

Prepare answers, don't be defensive. HN debates = free distribution.

---

## Timeline (Solo, Full-Time)

| Week | Focus | Output |
|---|---|---|
| Week 1 | SDK extraction + packaging | `@memexai/core` published to npm (beta) |
| Week 2 | `npx memex-admin` CLI + examples | Two working framework examples |
| Week 3 | README, docs, HN post draft | Launch-ready repo |
| Week 4 | Launch + respond | HN post live, iterate on feedback |

---

## Post-Launch (Weeks 5–8)

Don't build features immediately after launch. The most valuable post-launch work:

1. **Respond to every GitHub issue personally** — converts curious devs into advocates
2. **Write the "why not vectors" blog post** — SEO, gives HN commenters something to link
3. **Watch what people actually use it for** — real usage patterns will be different from assumptions
4. **Python SDK only if** — 3+ requests come in from the launch

---

## Open Questions

- [ ] What's the npm package name? `memexai`, `@memexai/core`, `memex-core`?
- [ ] Is abodex.space architecture shareable as a "built with memexai" reference? (Social proof)
- [ ] MCP server mode — ship as part of `@memexai/core` or separate package? (Has direct Anthropic/Claude distribution upside)
- [ ] License — currently? MIT is best for OSS credibility, Apache 2 if you want patent protection.
