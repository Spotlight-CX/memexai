# memexai Roadmap

Agent memory on Postgres. No vector store. Audit trail included.

---

## Shipped (core loop)

- `@memexai/core` — direct Postgres TypeScript SDK
- `@memexai/sdk` — HTTP client SDK
- `@memexai/admin` — admin CLI + UI (`npx @memexai/admin`)
- Docker compose — Postgres + HTTP service + admin UI
- Four memory tools: `memory_list`, `memory_read`, `memory_write`, `memory_patch`
- Framework adapters: Vercel AI, Anthropic, LangChain
- Revision history — every write creates a full snapshot
- Access logs — every tool call logged
- Virtual path isolation — `user/` auto-scoped to userId, `shared/` read-only
- Two deployment modes: container (HTTP service) and direct Postgres
- Docs: architecture, scopes, revisions, access logs, migrations

---

## Tier 1 — Launch Blockers

### Python SDK [`product/specs/01-python-sdk.md`]
Direct Postgres Python client. Mirrors `@memexai/core` exactly. LangChain, LlamaIndex, CrewAI adapters. PyPI: `pip install memexai`.

### Smart context assembler [`product/specs/02-smart-context.md`]
`memory_smart_read` tool — loads all user memory in one call if it fits within a char budget; BFS-merges by recency if too large. Replaces the current hardcoded three-file `getPromptBlock`. Also adds `memory_search` (BM25 via Postgres `tsvector`).

### MCP server [`product/specs/03-mcp-server.md`]
`@memexai/mcp` — expose memory tools to Claude Desktop, Cursor, Windsurf. Two lines in `claude_desktop_config.json`. High virality, low build cost.

---

## Tier 2 — Significant Differentiation

### Pre-write hooks + PII redaction [`product/specs/04-pii-hooks.md`]
Container mode: `MEMEX_PII_POLICY=redact` env var — server-side, zero client changes. Direct mode: `memex.addHook("before_write", createPiiRedactHook())`. GDPR/HIPAA compliance story — unoccupied niche in the memory market.

### Agentic ingestion [`product/specs/05-agentic-ingest.md`]
`memex.ingest(text, ctx, { model })` — pass raw conversation text, LLM extracts durable facts and writes them using the memory tools. Full audit trail (unlike mem0's black-box extraction). Dry-run mode for human-in-the-loop review.

### Agentic recall [`product/specs/06-agentic-recall.md`]
`user.recall(query)` — targeted mid-conversation retrieval. BM25-ranked, optional LLM reranker. Also exposed as `memory_recall` tool so agents can invoke it themselves. Complements `memory_smart_read` (which is for system prompt assembly).

---

## Tier 3 — Post-Launch

### Memory compaction [`product/specs/07-memory-compaction.md`]
Auto-summarize files that exceed a size threshold. Archive original, overwrite with LLM-compacted version. Triggered on-write or manually via admin UI. Keeps memory lean for long-running agents.

### Webhooks (post-write hooks)
`memex.addHook("after_write", fn)` — trigger Slack, n8n, Zapier, or custom endpoints after any write. Powers notification and automation use cases. Tracked here, no spec yet.

### Org / workspace namespacing
Add `org/` or `workspace/` scope above `user/`. Currently only `user/` and `shared/`. Defer until there's a real enterprise customer with a multi-tenant need. Tracked here, no spec yet.

---

## Competitive Positioning

| | mem0 | Zep | Letta | **memexai** |
|---|---|---|---|---|
| Storage | Vector + graph | Graph (needs Neo4j) | Tiered in-context | **Postgres only** |
| Self-hosted | ✅ (needs vector DB) | ❌ killed Apr 2025 | ❌ managed | **✅ just Postgres** |
| Revision history | ❌ | ❌ | ❌ | **✅** |
| Admin UI | ❌ | ✅ cloud | ✅ cloud | **✅ self-hosted** |
| PII hooks | ❌ | ❌ | ❌ | **roadmap (Tier 2)** |
| Python SDK | ✅ | ✅ | ✅ | **roadmap (Tier 1)** |
| MCP server | ❌ | ❌ | ❌ | **roadmap (Tier 1)** |
| Funding | $24M Series A | $500K seed | $10M seed | bootstrapped |

**Defensible angle:** self-hosted + Postgres-only + full audit trail. Zep killed self-hosting; mem0 requires a vector store; nobody ships revision history. These three properties together are unoccupied.

---

## Research

Market research compiled: [`docs/research/market-2026.md`](../docs/research/market-2026.md)
