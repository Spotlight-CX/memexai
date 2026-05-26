# memexai Roadmap

## North Star

> "Human taste is now more important than ever as codegen tools make everyone a 10x engineer."
> — Leo Paz (Outlit, W25)

Leo was talking about engineers. But the insight is universal.

AI can now write, advise, plan, and act at near-zero marginal cost. The bottleneck is no longer capability — it is knowing **whose** taste to apply. Not just for engineers. For anyone interacting with an AI agent: the career coach user who has specific anxieties about interviews, the finance app user who hates aggressive upsells, the creative writing user who writes in a particular voice.

Every person has taste. AI currently ignores it — because it has no way to hold it.

MemexAI is the infrastructure that captures and maintains human taste so AI can act confidently on a person's behalf. Not "what did the user say?" — "who is this user?" When the AI knows your taste — your preferences, friction points, style, and identity — it can reduce the decisions you need to make, not just answer questions faster.

The end state: an AI that genuinely knows each user well enough to act for them with high confidence.

---

Memory as structured, inspectable files — curated by an agent as work happens, then reasoned over with lightweight file tools.

MemexAI is not primarily a chat-log retrieval engine. The core bet is not:

```text
store every chat session -> vector search old chunks -> answer from retrieved logs
```

The core bet is:

```text
observe a session -> write only durable facts -> maintain inspectable memory files -> recall targeted records later
```

Raw conversation logs can still exist outside MemexAI for replay, audit, or analytics. MemexAI owns curated working memory: profiles, preferences, timelines, commitments, decisions, project context, and source-backed updates.

---

## Done

- `@memexai/core` — direct Postgres TypeScript SDK
- `@memexai/sdk` — HTTP client SDK
- Python SDK — direct Postgres + HTTP client, with LangChain, LlamaIndex, and CrewAI adapters
- `@memexai/admin` — admin CLI + UI
- Docker compose — Postgres + HTTP service + admin UI
- Service MCP server — SSE transport over the same tool engine
- Raw memory tools — `memory_list`, `memory_read`, `memory_write`, `memory_patch`
- Agentic memory tools — `memory_memorize`, `memory_search`
- Smart context tool — `memory_smart_read`
- Postgres full-text search — generated `tsvector`, no vector database required
- Agentic search path — BM25 shortlist, optional model-backed read-only synthesis
- Bookkeeping prompts — `user/index.md`, `user/log.md`, and `## See also` links during memorize
- Admin memory editor — inspect and edit files through the dashboard
- Revision history — every write creates a full snapshot
- Access logs — every tool call is logged
- Virtual path isolation — `user/` auto-scoped to `userId`, `shared/` read-only
- Framework adapters — Vercel AI, Anthropic, LangChain, LlamaIndex, CrewAI
- Dual deployment — containerized HTTP service and direct Postgres mode

---

## Next

### Shared memory bookkeeper + admin setup (shipped)
`shared/index.md` is now a root driver pointing to sub-files. `shared/user-memory.md` provides the default memory management guide. `buildPromptBlock()` now injects all `shared/` files so every new sub-file is immediately visible to agents. First-time admins land on a guided setup wizard (`/admin/setup`) — 3-step form generates initial shared memory files. Ongoing refinement via a Gemini-powered Configure tab in the admin UI.

### Team Memory — contribution requests
The next evolution of shared memory: individual agents or users can propose contributions to `shared/` that admins review before they become canonical context.

How it works:
- New tool `memory_propose` queues a contribution (fact or file edit) targeting `shared/`
- Admin sees pending proposals in the Configure tab (or a dedicated Proposals tab)
- Accept / reject / auto-approve modes (auto-approve after N approvals, or by trusted user ID)
- Accepted proposals applied via existing admin file write path (full audit trail)
- Makes `shared/` a living team knowledge base, not just operator-set defaults

Why it matters: the gap between "operator configures once" and "team learns together" is where most memory systems stagnate. This closes it without requiring manual curation of every insight.

### Launch polish
Make the first 10 minutes excellent: clear quick-test flow, copyable SDK snippets, better examples, and fewer places where a new developer has to infer the happy path.

Why it matters: adoption depends on the product feeling obvious before it feels powerful.

### Memory health
Add a simple health loop for stale files, index drift, duplicate facts, missing links, failed writes, and low-signal memory.

Why it matters: durable memory only matters if people can trust it over time.

Keep it simple: start with diagnosis and visibility. Auto-fix comes later.

### Memory compaction
When files get too large, summarize and deduplicate while preserving durable facts and keeping the original readable in an archive.

Why it matters: inspectable files should stay useful to humans and agents.

Keep it simple: preserve provenance and make compaction explicit in revision history.

### PII hooks
Support redaction/blocking before writes in service mode and direct SDK mode.

Why it matters: memory systems are trust systems. Sensitive data handling should be boring and inspectable.

Keep it simple: regex-first, optional heavier integrations later.

### Post-write hooks
Let developers trigger webhooks or callbacks after memory changes.

Why it matters: memory writes often need to update surrounding workflows: Slack, n8n, Zapier, app events, or audit stores.

Keep it simple: one clear after-write contract before adding connector-specific features.

---

## Later Bets

These are not feature tickets. They are product directions to revisit when they clearly make MemexAI more durable, legible, trustworthy, or easier to adopt.

### Local-first memory mode
Explore a zero-server local mode for developers who want memory running beside their agent without Docker or hosted infrastructure.

Why it matters: "try it in two minutes" is a different adoption curve than "stand up infrastructure first."

Restraint: preserve the same mental model as the service: files, scopes, auditability, and search.

### Source-scoped memory
Organize memory around projects, teams, customers, workspaces, or imported knowledge bases, not only `shared/` and per-user files.

Why it matters: real memory often belongs to a context bigger than one user.

Restraint: clearer boundaries first, permission machinery later.

### Link-aware memory
Treat explicit links between memory files as first-class signals.

Why it matters: visible links make memory more navigable for humans and more useful for agents without hiding the system's reasoning.

Restraint: start from links users can see in the files. Avoid invisible graph magic.

### Optional deeper retrieval
Keep Postgres full-text search as the default, but leave room for stronger retrieval when memory sets get much larger or messier.

Why it matters: some teams will outgrow keyword search.

Restraint: this must stay opt-in and measurable. No vector infrastructure as a default requirement.

### Disciplined ingestion
Support repeatable ways to bring in notes, transcripts, docs, and app events without pretending every raw input deserves to become memory.

Why it matters: MemexAI's thesis is selective durable memory, not hoarding.

Restraint: the product question is "what should be remembered?", not "how many connectors can we ship?"

### Product-shaped evals
Evaluate the behaviors that matter: remembering the right facts, finding them later, preserving context, and avoiding junk accumulation.

Why it matters: evals let us say no to features that make the product bigger without making memory more trustworthy.

Restraint: useful decision support over benchmark theater.

---

## Competitive Position

| | mem0 | Zep | Supermemory | **memexai** |
|---|---|---|---|---|
| Primary mental model | Retrieve old chat chunks | User memory graph / facts | Memory retrieval API | **Curated durable files** |
| Typical flow | Store messages, embed, retrieve | Extract/graph, retrieve | Ingest chunks, hybrid retrieve | **Agent writes durable records** |
| Best at | Semantic chat recall | Managed user memory | Fast retrieval over memory corpus | **Inspectable system of record** |
| Storage | Vector + graph | Graph / managed service | Managed memory infra | **Postgres files** |
| Raw session storage as memory | Common/default | Common input | Common input | **Optional, not the point** |
| Human editability | Limited | Managed UI | Managed API/UI | **First-class files + admin** |
| Revision history | Limited/opaque | Limited/managed | Limited/managed | **Every write snapshot** |
| Self-hosted | Needs extra infra | No longer core offering | Managed-first | **Just Postgres** |
| Vector DB required | Usually yes | No for user, infra hidden | Infra hidden | **No** |

The honest tradeoff:

- **MemexAI wins** when memory should be small, inspectable, editable, auditable, source-backed, and easy to self-host.
- **Vector/chat-log systems win** when the main task is recovering arbitrary details from huge raw conversation histories, especially if those details were not recognized as durable at write time.

Defensible angle: self-hosted + Postgres-only + full audit trail + human-editable memory files. The lane is durable agent memory, not semantic search over transcripts.

---

## Out of Scope

- SSO / IAM until there is a real customer pull
- Knowledge graph visualization
- Vector / semantic embeddings as a default requirement
- Automatic conversation extraction without developer opt-in
- Connector sprawl without a memory-quality reason

---

## Research

Market research with citations and source URLs: [`docs/research/market-2026.md`](docs/research/market-2026.md)
