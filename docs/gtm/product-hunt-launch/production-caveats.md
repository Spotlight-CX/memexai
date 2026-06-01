# Production Caveats

Use this as the internal source of truth when answering technical launch questions. Tone: direct, calm, and specific. The public docs version lives at `apps/website/content/docs/operations/production-caveats.mdx`.

## Short answer

MemexAI is usable for early production pilots where teams want inspectable, Postgres-backed agent memory and are comfortable operating an early-stage service. The honest caveat is that some hardening work is still manual or roadmap-bound: concurrent write conflict handling, automated retention, multilingual/semantic search, and per-user dreaming budgets.

## Caveat 1: concurrent writes

Current behavior: `memory_write` is last-write-wins for a single memory file.

What to say:

> Today, MemexAI expects most memory writes to happen through one agent/session path. If you run multiple agents against the same user file concurrently, use narrower files or serialize writes at the app layer. Optimistic locking is a post-launch hardening item.

Why it is acceptable for launch: the common proof path writes one user's preference into one profile file from one agent loop.

## Caveat 2: revision and access-log growth

Current behavior: revisions and access logs grow with usage. A manual revision prune endpoint now exists; automatic TTL does not.

What to say:

> MemexAI keeps revisions and access logs intentionally because they are the audit trail. For early deployments, operators can prune old revisions from the admin UI or `POST /v1/admin/revisions/prune`. Automatic retention policies are on the roadmap.

Why it is acceptable for launch: this is an operations cost concern, not a core-loop blocker. Manual revision pruning reduces one storage-growth path for pilots, but access-log retention and sensitive-data deletion still need app-level policy.

## Caveat 3: search language support

Current behavior: fallback search uses Postgres full-text search. Model-backed search can reason over returned files, but fallback recall is not semantic.

What to say:

> The built-in fallback search is Postgres full-text search. It is simple and inspectable, but teams with heavy multilingual or paraphrase recall needs should test real queries and watch the roadmap for hybrid vector and Postgres full-text search.

Why it is acceptable for launch: MemexAI's strongest launch claim is inspectable durable memory plus prompt injection, not best-in-class semantic retrieval.

## Caveat 4: dreaming token cost

Current behavior: dreaming has per-run caps and cadence controls, but no daily per-user budget across cycles.

What to say:

> Dreaming is opt-in. It attempts to consolidate duplicates and contradictions after quiet periods, but operators should inspect dream-agent revisions before enabling it broadly. Per-user budget controls are roadmap work.

Why it is acceptable for launch: the product works without dreaming. Dreaming should be positioned as an advanced maintenance loop, not as required infrastructure.

## Persona notes

Infra engineer: wants exact endpoints, tables, and failure modes. Point them to the public Production Considerations page and avoid hand-waving.

Product founder: wants to know whether this blocks an MVP. Say no for pilots, yes for high-scale regulated memory without additional app-level controls.

Skeptical AI engineer: wants to know if this is just RAG. Bring the answer back to inspectable files, prompt injection, corrections, revisions, and access logs.
