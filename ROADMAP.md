# memexai Roadmap

Memory as structured, inspectable files — reasoned over by a lightweight LLM agent, not retrieved by vector similarity. Same philosophy as how Claude Code navigates a codebase: give the model file tools and let it think.

No vector search. The model's reasoning is the retrieval engine.

---

## Shipped

- `@memexai/core` — direct Postgres TypeScript SDK
- `@memexai/sdk` — HTTP client SDK
- `@memexai/admin` — admin CLI + UI (`npx @memexai/admin`)
- Docker compose — Postgres + HTTP service + admin UI
- Four memory tools: `memory_list`, `memory_read`, `memory_write`, `memory_patch`
- Framework adapters: Vercel AI, Anthropic, LangChain
- Revision history — every write creates a full snapshot
- Access logs — every tool call logged
- Virtual path isolation — `user/` auto-scoped to userId, `shared/` read-only
- Dual deployment: container (HTTP service) and direct Postgres
- Docs: architecture, scopes, revisions, access logs, migrations

---

## Tier 1 — Launch Blockers

### Python SDK → [`product/specs/01-python-sdk.md`](product/specs/01-python-sdk.md)
Direct Postgres Python client. Mirrors `@memexai/core` exactly. `asyncpg`, inline migrations, LangChain + LlamaIndex + CrewAI adapters. PyPI: `pip install memexai`.

### Smart context assembler → [`product/specs/02-smart-context.md`](product/specs/02-smart-context.md)
New `memory_smart_read` tool — loads all user memory in one call if it fits within a char budget; BFS-merges by recency if too large. Replaces the current hardcoded three-file `getPromptBlock`. Includes `memory_search` (BM25 via Postgres `tsvector GENERATED ALWAYS AS STORED` — no trigger needed). BM25 also serves as a pre-filter for the agentic retrieval harness — shortlists candidate files before the LLM reasons over them.

### Smart index auto-maintenance
After every `memex.ingest()` write, a post-write hook updates `user/index.md` with a short summary of the changed file. This gives the retrieval agent a navigation map (what each file contains, when last updated) without reading all file contents upfront. Distinct from `memory_smart_read`, which loads files dynamically — this is a proactively maintained table of contents. Lightweight LLM call: given the changed file, update its index entry. Configurable: enabled by default when `memex.ingest()` is used.

### MCP server → [`product/specs/03-mcp-server.md`](product/specs/03-mcp-server.md)
`@memexai/mcp` — two lines in `claude_desktop_config.json`, memory tools appear in Claude Desktop, Cursor, Windsurf. Direct Postgres mode (local, no auth) and HTTP proxy mode. High virality, low build cost.

---

## Tier 2 — Significant Differentiation

### Pre-write hooks + PII redaction → [`product/specs/04-pii-hooks.md`](product/specs/04-pii-hooks.md)
Container mode: `MEMEX_PII_POLICY=redact|block|off` env var — server-side, zero client changes needed. Direct mode: `memex.addHook("before_write", createPiiRedactHook())`. Regex patterns for email, phone, SSN, credit card, IP. Optional Presidio integration for NLP-based detection. GDPR/HIPAA compliance story — unoccupied niche in the market.

### Agentic ingestion → [`product/specs/05-agentic-ingest.md`](product/specs/05-agentic-ingest.md)
`memex.ingest(text, ctx, { model })` — pass raw conversation text, LLM extracts durable facts and writes them via the memory tools. Write-only tool access (prevents runaway reads). Full audit trail — unlike mem0's black-box extraction. Dry-run mode for human review. Hooks fire on ingest writes (PII applies).

### Agentic recall → [`product/specs/06-agentic-recall.md`](product/specs/06-agentic-recall.md)
`user.recall(query)` — targeted mid-conversation retrieval. BM25-ranked fast path; optional LLM reranker for precision. Also exposed as `memory_recall` tool so agents can invoke it themselves. Complements `memory_smart_read` (system prompt assembly) — recall is for surgical mid-conversation lookups.

---

## Tier 3 — Post-Launch

### Memory compaction → [`product/specs/07-memory-compaction.md`](product/specs/07-memory-compaction.md)
When a file exceeds a configurable threshold (default 16K chars), LLM summarizes and deduplicates while preserving durable facts. Archives original under `user/archive/` (as a readable file) — spec 07 chose this over storing archives in `mx_revision` so agents can reference old archives directly via memory tools. Triggered on-write (async, non-blocking) or manually via admin UI "Compact now" button. Revision created with `reason: "auto-compaction"`.

### Human memory editor in admin UI
Admin can edit, delete, or rewrite any memory entry directly in the dashboard. Edits create a new revision with `actor: admin`. Builds on the existing revision trail — no new schema needed.

### Webhooks (post-write)
`memex.addHook("after_write", fn)` — trigger Slack, n8n, Zapier, or custom endpoints after any write. Powers notification and automation use cases.

### Org / workspace namespacing
Proper `org/` or `workspace/` scope above `user/`. Currently only `user/` and `shared/`. Defer until there's a real enterprise customer requesting it.

---

## Competitive Position

| | mem0 | Zep | Letta | **memexai** |
|---|---|---|---|---|
| Storage | Vector + graph | Graph (needs Neo4j) | Tiered in-context | **Postgres only** |
| Self-hosted | ✅ needs vector DB | ❌ killed Apr 2025 | ❌ managed | **✅ just Postgres** |
| Revision history | ❌ | ❌ | ❌ | **✅** |
| Admin UI | ❌ | ✅ cloud | ✅ cloud | **✅ self-hosted** |
| PII hooks | ❌ | ❌ | ❌ | **Tier 2** |
| Python SDK | ✅ | ✅ | ✅ | **Tier 1** |
| MCP server | ❌ | ❌ | ❌ | **Tier 1** |
| Funding | $24M Series A | $500K seed | $10M seed | bootstrapped |

Defensible angle: self-hosted + Postgres-only + full audit trail. Zep killed self-hosting; mem0 requires a vector store; nobody ships revision history. These three together are unoccupied.

---

## Out of Scope (OSS edition)

- SSO / IAM
- Knowledge graph visualization
- Vector / semantic embeddings
- Automatic conversation extraction without developer opt-in

---

## Research

Market research with citations and source URLs: [`docs/research/market-2026.md`](docs/research/market-2026.md)
