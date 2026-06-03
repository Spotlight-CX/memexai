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

### Files time travel (low-hanging, high priority)
Use existing revision history to let operators browse memory as of a timestamp.

How it works:
- Add an "As of timestamp" mode to the Files view
- Back the view with `mx_revision` queries that select the latest revision per path at or before the selected timestamp
- Build the historical file tree from revision paths instead of current `mx_file`
- Show historical file content and allow diffing against current content

Why it matters: this gives operators an immediate way to inspect "what did memory look like then?" without new database schema. It is the fastest useful slice of the broader audit story.

Restraint: this reconstructs file state, not request-level memory usage. If revisions are pruned, deleted, or missing, older time travel is only as complete as the retained revision history.

Design doc: [`docs/roadmap/004-memory-time-travel.md`](docs/roadmap/004-memory-time-travel.md)

### Memory context snapshots
Revision history answers "what changed?" Timestamp queries answer "what did files look like then?" Memory context snapshots answer the more important production question: "what memory was actually exposed to the agent/model for this request?"

How it works:
- Prompt builds, raw reads, agentic recall, smart reads, memorize internals, and dream runs create memory context snapshots when they expose file content to an agent/model
- Each snapshot records `snapshot_id`, `kind`, `status`, `user_id`, request correlation, exposed file paths, revision IDs, and optional content hashes
- The Files view can jump to a timestamp, request, or session and show either reconstructed file state or per-request exposed memory
- Admins can diff historical file state or request-exposed memory against current files
- Observation events and external traces can link back to the MemexAI snapshot ID

Why it matters: memory is operating state. If an agent made a decision, a team should be able to reconstruct the exact memory state that could have influenced it, even after dreaming or manual edits changed the current files.

Design doc: [`docs/roadmap/004-memory-time-travel.md`](docs/roadmap/004-memory-time-travel.md)

### Memory health signals
Turn access logs, revisions, prompt-block events, and future metadata into a review queue for memory that may be stale, ownerless, overused, or contradictory.

Signals to start with:
- Never used in 30 days
- Written by a one-off agent
- No owner
- Frequently injected but never updated
- Possible conflict with newer memory

Why it matters: durable memory degrades silently unless operators can see where trust is decaying. Start with diagnosis and visibility; auto-fix comes later.

Design doc: [`docs/roadmap/005-memory-health-signals.md`](docs/roadmap/005-memory-health-signals.md)

### Ownership, TTL, and provenance
Add governance metadata that lets people and maintenance jobs reason about memory as a managed record, not just a file.

Fields to introduce carefully:
- `owner`
- `ttl` / review window
- `observed_at`
- source or lineage metadata
- `last_read_at`
- `last_injected_at`

Why it matters: unowned memory is where stale facts go to become invisible product risk. Ownership and TTL turn "should we still trust this?" into an explicit workflow.

Restraint: computed signals should ship first where possible. Add persistent fields only when they support clear review, ranking, or audit behavior.

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

### PII hooks
Support redaction/blocking before writes in service mode and direct SDK mode.

Why it matters: memory systems are trust systems. Sensitive data handling should be boring and inspectable.

Keep it simple: regex-first, optional heavier integrations later.

### Post-write hooks
Let developers trigger webhooks or callbacks after memory changes.

Why it matters: memory writes often need to update surrounding workflows: Slack, n8n, Zapier, app events, or audit stores.

Keep it simple: one clear after-write contract before adding connector-specific features.

### Sidecar memory writes
Add an optional `raw_data` argument to `memory_write`. When provided, MemexAI writes the payload directly to Postgres without including it in the model's context window — the content bypasses the LLM turn entirely. The `memory_memorize` agentic loop is extended to issue sidecar writes: after its normal reasoning pass it emits a final direct-write for any structured or bulk data it has designated a target path for, without sending that data back through the model.

Why it matters: agents that ingest large transcripts, documents, or structured payloads today either flood their own context budget or require a separate out-of-band write. Sidecar writes make bulk ingestion a first-class memory primitive while keeping the agentic loop cheap.

Keep it simple: `raw_data` is a string or base64-encoded blob, same write path, same audit trail. No new tables.

### Dreaming budgets and exclusions
Add per-user consolidation budgets and per-file dreaming exclusions.

Why it matters: dreaming is now shipped infrastructure, but operators still need cost controls and ways to protect sensitive or hand-curated files from background edits.

Keep it simple: start with explicit admin controls before adding policy automation.

### Memory compaction (absorbed unless archive/restore becomes necessary)
Dreaming now covers the main compaction job: summarize, deduplicate, and keep long-running memory readable while preserving revisions.

What remains: explicit archive/restore workflows if customers need to preserve large originals as operator-visible files.

Restraint: do not build a separate compaction subsystem until the archive/restore need is concrete.

---

## Later Bets

These are not feature tickets. They are product directions to revisit when they clearly make MemexAI more durable, legible, trustworthy, or easier to adopt.

### Local-first memory mode
Explore a zero-server local mode for developers who want memory running beside their agent without Docker or hosted infrastructure.

Why it matters: "try it in two minutes" is a different adoption curve than "stand up infrastructure first."

Restraint: preserve the same mental model as the service: files, scopes, auditability, and search.

### Configurable named mounts
Let developers register additional memory scopes at init time beyond `user/` and `shared/`. A team itinerary planner configures `{ team: teamId }` and agents write to `team/itinerary.md` alongside `user/prefs.md` — both scopes active in the same call.

Design doc: [`product/specs/10-named-mounts.md`](product/specs/10-named-mounts.md)

Why it matters: the `user/` scope is insufficient when the isolation unit is a team, org, workspace, or session. Current workaround (pass group ID as userId) prevents simultaneous user + group memory.

Restraint: no migration needed — `mx_file` already supports arbitrary physical prefixes. Build when a paying customer asks, not before.

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
