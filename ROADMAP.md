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
- Bidirectional backlink index — `mx_backlink` table, hub scoring via `importance_score`, inbound files surfaced in `memory_smart_read` (spec: [`docs/roadmap/001-backlink-index.md`](docs/roadmap/001-backlink-index.md))
- Files time travel — "As of" mode in the admin Files view, historical file tree from `mx_revision`, diff against current (spec: [`docs/roadmap/004-memory-time-travel.md`](docs/roadmap/004-memory-time-travel.md))

---

## Next

Priority order. Each item has a spec file with design, test plan, and success criteria.

### 1. Memory health signals
Turn access logs, revisions, and prompt-block events into a review queue for memory that may be stale, ownerless, overused, or contradictory. Start with signals computable from existing data — never-read files, one-off-agent writes, frequently-injected-but-never-updated files. Spec: [`docs/roadmap/005-memory-health-signals.md`](docs/roadmap/005-memory-health-signals.md)

Why now: memory degrades silently. Operators need diagnostics before trust erodes.

### 2. Confidence and provenance metadata
Add `confidence REAL` and `source_type TEXT` to `mx_file`. Dream consolidation sets `source_type = 'consolidated'` and propagates `confidence = min(inputs)`. Agents can explicitly mark inferred writes. Ranking multiplies base score by confidence so explicit facts beat inferred guesses. Spec: [`docs/roadmap/002-confidence-metadata.md`](docs/roadmap/002-confidence-metadata.md)

Why now: dreaming is live but has no way to signal epistemic quality. Contradicted memories persist at full weight until the next dream run.

### 3. Hybrid BM25 + vector search with RRF
Optional `embed` function at `createMemex()`. On write, generate and store embeddings in a new `pgvector` column. On search, run BM25 and vector in parallel, merge with Reciprocal Rank Fusion (`1/(60+bm25_rank) + 1/(60+vector_rank)`). Falls back to BM25-only if no embed function provided — no hard dependency, no regression. Spec: [`docs/roadmap/003-hybrid-search-rrf.md`](docs/roadmap/003-hybrid-search-rrf.md)

Why now: semantic gaps that BM25 can't bridge ("loves parks" vs "nature green space") force agents to issue multiple reformulated queries or miss memories entirely.

### 4. Launch polish
Clear quick-test flow, copyable SDK snippets, better examples, fewer places where a new developer has to infer the happy path.

Why now: adoption depends on the product feeling obvious before it feels powerful.

### 5. PII hooks and post-write hooks
PII: redaction/blocking before writes, regex-first. Post-write: webhooks or callbacks after memory changes for Slack, n8n, Zapier, audit stores.

Why now: memory systems are trust systems. Sensitive data handling and workflow integration should be boring and inspectable.

### 6. Team memory — contribution requests
`memory_propose` tool queues a write to `shared/` that admins review before it becomes canonical. Accept / reject / auto-approve modes. Closes the gap between "operator configures once" and "team learns together."

### 7. Sidecar memory writes
Optional `raw_data` arg to `memory_write`. Payload goes directly to Postgres without entering the model's context window — useful for bulk ingestion of transcripts, structured payloads, or large data the agent has already processed.

---

## Later Bets

Not tickets. Product directions to revisit when they clearly make MemexAI more durable, legible, trustworthy, or easier to adopt.

### Local-first memory mode
Zero-server local mode — memory running beside the agent without Docker or hosted infrastructure. Same mental model: files, scopes, auditability, search.

### Configurable named mounts
Register additional memory scopes at init time beyond `user/` and `shared/`. A team planner configures `{ team: teamId }` and agents write to `team/itinerary.md` alongside `user/prefs.md`. Design: [`product/specs/10-named-mounts.md`](product/specs/10-named-mounts.md). Build when a paying customer asks.

### Source-scoped memory
Organize memory around projects, teams, customers, or workspaces — not only `shared/` and per-user files.

### Memory context snapshots
Per-request audit artifact recording which memory files were exposed to the agent/model during a prompt build or tool call. Links to revision IDs for diffing historical exposure against current files. Described in [`docs/roadmap/004-memory-time-travel.md`](docs/roadmap/004-memory-time-travel.md). Deferred until time travel ships and operators confirm the need.

### Dreaming budgets and exclusions
Per-user consolidation budgets and per-file dreaming exclusions. Start with explicit admin controls before adding policy automation.

### Disciplined ingestion
Repeatable ways to bring in notes, transcripts, docs, and app events without treating every raw input as memory. The product question is "what should be remembered?" not "how many connectors can we ship?"

### Product-shaped evals
Evaluate behaviors that matter: remembering the right facts, finding them later, preserving context, avoiding junk accumulation. Decision support over benchmark theater.

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
| Vector DB required | Usually yes | No for user, infra hidden | Infra hidden | **No (optional, not default)** |

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
