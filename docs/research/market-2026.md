# AI Agent Memory Market Research — May 2026

Research compiled during memexai launch planning. Covers competitors, funding, validated pain points, and compliance landscape.

---

## Competitors

### mem0

- **What it is:** Universal memory layer. LLM extracts facts from conversations → stores in vector + graph store. Single-pass ADD-only extraction. Multi-signal retrieval: semantic + BM25 + entity matching scored in parallel.
- **Graph variant (Mem0g):** Directed labeled knowledge graph for multi-hop reasoning. Launched 2025. Conflict detector flags when new info contradicts existing graph elements.
- **Open source vs cloud:** Core is open source. Advanced features (Graph Memory, unlimited retrieval, analytics) are cloud-only.
- **Pricing:** Free: 10K memories/month. Standard ($19/mo): 50K memories, vector search. Pro ($249/mo): Graph features, unlimited retrieval.
- **Funding:** $24M Series A, October 2025. Led by Basis Set Ventures. YC, Peak XV, GitHub Fund participated. Angels: Scott Belsky, Dharmesh Shah, CEOs of Datadog, Supabase, PostHog, Weights & Biases.
- **Traction:** 35M API calls Q1 2025 → 186M API calls Q3 2025 (~30% MoM growth).
- **Performance:** 91% lower p95 latency vs full-context methods. 67.13% on LoCoMo benchmark. p95 search latency 0.200s. Saves 90%+ token costs.
- **Weakness:** Black-box writes. Hard to audit, hard to delete (machine unlearning is immature). No self-hosted story with built-in admin.

Sources:
- https://mem0.ai/
- https://mem0.ai/pricing
- https://mem0.ai/series-a
- https://arxiv.org/abs/2504.19413
- https://mem0.ai/blog/state-of-ai-agent-memory-2026
- https://mem0.ai/blog/context-window-is-ram-not-storage-why-most-agent-failures-happen-how-to-fix-them-in-2026
- https://docs.mem0.ai/open-source/python-quickstart

---

### Zep

- **What it is:** Temporal knowledge graph. Graphiti (open source) synthesizes conversational data with structured business data. Each fact has a "validity window" — when it became true and when superseded.
- **Self-hosted status:** Community Edition deprecated April 2025. Self-hosting now requires Graphiti + a graph database (Neo4j, FalkorDB, or Kuzu) — minimum three services to provision. Effectively killed simple self-hosting.
- **Funding:** $500K seed from YC, April 2024. No Series A announced. Weakest funding signal in the category.
- **Performance:** Memory footprint 600,000+ tokens/conversation vs 1,764 for mem0 (significant inefficiency at scale). Self-reported 75.14% on LoCoMo benchmark (disputed — original testing showed lower due to configuration).
- **2025–2026 positioning:** Rebranded to "context engineering platform."
- **Gap created:** The death of Zep self-hosted left a real gap — no simple, self-hosted, Postgres-only, no-graph-DB solution exists.

Sources:
- https://www.getzep.com/
- https://arxiv.org/abs/2501.13956
- https://atlan.com/know/zep-vs-mem0/

---

### Letta (formerly MemGPT)

- **What it is:** LLM-as-OS paradigm. Tiered memory: core memory (always in system prompt), archival memory (external disk-like), recall memory (conversation history). Agents move data between in-context RAM and stored disk.
- **Recent pivots:** Rearchitected agent loop (Oct 2025) for frontier reasoning models (GPT-5, Claude 4.5 Sonnet). Conversations API (Jan 2026) — agents maintain shared memory across parallel user experiences.
- **Funding:** $10M seed, September 2024. Led by Felicis Ventures at $70M post-money valuation. Angels: Jeff Dean (Google DeepMind), Clem Delangue (HuggingFace), Cristobal Valenzuela (Runway), Jordan Tigani (MotherDuck), Tristan Handy (dbt Labs).
- **Revenue:** $1.4M ARR by June 2025 (13-person team).
- **Performance:** ~83.2% on LoCoMo benchmark (open-source). Strong for agents that need to operate independently for days.
- **Weakness:** Complex setup, needs managed infra. Not Postgres-native.

Sources:
- https://www.letta.com/
- https://www.prnewswire.com/news-releases/berkeley-ai-research-lab-spinout-letta-raises-10m-seed-financing-led-by-felicis-to-build-ai-with-memory-302257004.html

---

### Cognee

- **What it is:** Open-source memory control plane. Combines embeddings, graphs, and cognitive science. MCP integration for Claude Code and others. 12K+ GitHub stars, 80+ contributors, 500x growth in 2025.
- **Funding:** $7.5M seed (2025) from Pebblebed, 42CAP, Vermilion Ventures.
- **Traction:** Live in 70+ companies. 2K → 1M+ pipeline runs in 2025.

Sources:
- https://www.cognee.ai/
- https://www.cognee.ai/blog/cognee-news/cognee-raises-seven-million-five-hundred-thousand-dollars-seed
- https://github.com/topoteretes/cognee

---

### Supermemory

- **What it is:** Open-source memory and context engine plus hosted developer platform. It positions itself as a full context stack: memory extraction, user profiles, hybrid RAG/search, connectors, file processing, MCP, and app/plugin surfaces.
- **Core API shape:** `client.add()` stores conversations/content under `containerTag`; `client.profile()` returns static profile facts, dynamic profile facts, and relevant search results in one call. Search supports hybrid memory + document retrieval.
- **MCP / agent tooling:** Hosted MCP exposes `memory`, `recall`, and `context` capabilities for Claude Desktop, Cursor, Windsurf, VS Code, Claude Code, OpenCode, OpenClaw, and Hermes-style clients.
- **Positioning:** Strong "memory as product" benchmark narrative. Public README claims #1 on LongMemEval, LoCoMo, and ConvoMem, with 81.6% on LongMemEval. It also ships MemoryBench for standardized comparisons.
- **Architecture signals:** Public repo is TypeScript-first, Bun monorepo, MIT licensed, and uses Postgres/Drizzle/Cloudflare-oriented infrastructure. It abstracts storage from developers rather than selling a Postgres-only deployment thesis.
- **Weakness / memexai opening:** Automatic extraction and managed context are powerful, but auditability and deterministic file-level control are not the headline. Supermemory also competes as a broad platform with connectors and hosted infrastructure; memexai can stay sharper as inspectable, self-hosted, Postgres-only memory with revisions.
- **How memexai should include it:** Treat Supermemory as a competitor, benchmark target, and optional bridge/migration target. Do not make it a default dependency. A future `supermemory-bridge` package could import/export data, dual-write `memex.ingest()` events, and run MemoryBench comparisons.

Sources:
- https://github.com/supermemoryai/supermemory
- https://supermemory.ai/docs
- https://supermemory.ai/docs/quickstart
- https://supermemory.ai/docs/concepts/memory-vs-rag
- https://supermemory.ai/docs/supermemory-mcp/mcp

---

### LangChain / LangGraph

- **Built-in memory:** Short-term (thread-level) via InMemorySaver (dev) or PostgresSaver (prod). Long-term cross-thread memory stores user-specific data across sessions.
- **Not a dedicated layer:** LangGraph is orchestration-focused, not a memory optimization platform. Designed to integrate with dedicated solutions like mem0, Zep, Cognee.

Sources:
- https://docs.langchain.com/oss/python/langgraph/add-memory/
- https://www.langchain.com/blog/launching-long-term-memory-support-in-langgraph

---

## Benchmark Comparison (LoCoMo, April 2026)

| System | Score | Notes |
|---|---|---|
| OMEGA | 95.4% | GPT-4.1 |
| Mastra Observational Memory | 94.87% | GPT-5-mini |
| SuperLocalMemory | 87.7% | |
| Supermemory | #1 claimed | Public README claims #1 on LoCoMo, LongMemEval, and ConvoMem; LongMemEval listed at 81.6% |
| Letta | ~83.2% | Open source |
| Zep/Graphiti | 71.2% (disputed) | Published, contested |
| mem0 | 67.13% | 91% lower latency, 90% token savings |

Sources:
- https://vectorize.io/articles/best-ai-agent-memory-systems
- https://github.com/supermemoryai/supermemory

---

## Validated Market Problems

**Agent amnesia:** "#1 complaint in AI agent communities is memory that resets between sessions." Every agent re-explains context in the next session.

**Context window degradation:** "A model claiming 200K tokens typically becomes unreliable around 130K, with sudden performance drops rather than gradual degradation."

**Working memory only:** Most agents have only context window storage. "Like trying to do your job using nothing but a whiteboard that gets wiped clean every evening."

**Infrastructure, not model problem:** "Agent memory is not a model problem — it is an infrastructure problem."

Sources:
- https://mem0.ai/blog/context-window-is-ram-not-storage-why-most-agent-failures-happen-how-to-fix-them-in-2026
- https://dev.to/diego_falciola_02ab709202/every-ai-agent-framework-has-a-memory-problem-heres-how-i-fixed-mine-1ieo
- https://news.ycombinator.com/item?id=47866304

**Production use case breakdown:**
- Customer service agents: 26.5% of production deployments
- Enterprise knowledge work: complex hierarchies, changing user state
- Coding / development agents: most forgetful
- Healthcare: require patient history, strict compliance

---

## PII and Compliance

### Regulations
- **GDPR:** Right to be forgotten, data sovereignty, breach notification when PII processed by third-party AI.
- **CCPA:** Similar deletion obligations, increasingly strict 2026.
- **HIPAA 2025 amendments:** Most significant overhaul in years. Encryption now mandatory for ePHI in transit and at rest. Every AI agent data path requires validated cryptographic modules.

### Architectural requirement
Advanced systems must automatically redact/tokenize PII before it reaches the LLM. Microsoft Presidio (Apache 2.0) is the standard open-source PII scanner.

### Gap
No current dedicated memory solution ships built-in PII hooks. Compliance is manual or bolted on. This blocks enterprise adoption in healthcare, finance, government — the highest-value segments.

Sources:
- https://www.privacyscrubber.com/compliance/gdpr/gdpr-ccpa-ai/
- https://www.hipaajournal.com/when-ai-technology-and-hipaa-collide/
- https://github.com/microsoft/presidio

---

## Agentic Reads and Writes

**mem0's approach:** Single-pass ADD-only extraction (one LLM call). Graph variant uses conflict detection. Implicit — the system decides what to remember, not the agent.

**Explicit vs implicit tradeoffs:**
- Explicit writes: full audit trail, GDPR-compliant, developer has delete capability. Higher latency.
- Implicit writes: seamless, lower latency. Hard to audit, hard to delete, machine unlearning is immature.
- **Hybrid is emerging as production norm:** Explicit for compliance-regulated domains (healthcare, finance). Implicit for preferences and conversational context.

**Developer preference:** Explicit writes preferred for regulated domains. Implicit winning for consumer/developer tools.

---

## Python Ecosystem

Frameworks that need memory (all Python-first):

| Framework | Memory Status |
|---|---|
| LangChain / LangGraph | Basic (conversation history + namespacing) |
| LlamaIndex | Acts as "data brain"; handles semantic indexing |
| CrewAI | Easy memory config; agents share context |
| AutoGen | Heavy Python; relies on external integrations |
| Pydantic AI | Minimal built-in memory |
| smolagents | Minimalist, code-centric; no built-in memory |

**mem0 Python SDK** (`pip install mem0ai`): Full CRUD, search, async, multi-agent, LangChain/LlamaIndex/CrewAI integrations. Default: OpenAI gpt-5-mini for extraction + Qdrant vector store.

Sources:
- https://softcery.com/lab/top-14-ai-agent-frameworks-of-2025-a-founders-guide-to-building-smarter-systems
- https://docs.mem0.ai/open-source/python-quickstart

---

## Market Size and Funding

- Global AI agents market: $7.6–7.8B (2025) → $10.9B+ (2026) → $52.62B (2030) at 46.3% CAGR
- 80% of enterprise apps embed ≥1 agent by Q1 2026 (vs. 33% in 2024)
- 40% of enterprise apps will have task-specific agents by 2026
- CB Insights mapped 400+ AI agent startups (Nov 2025); $9B aggregate funding
- Agentic AI: ~10% of AI funding rounds in 2025 (~$6.7B)

**Risk:** 40%+ of agentic AI projects at risk of cancellation by 2027 if governance, observability, and ROI clarity are not established.

Sources:
- https://www.salesmate.io/blog/ai-agents-adoption-statistics/
- https://www.lyzr.ai/state-of-ai-agents/
- https://arxiv.org/abs/2602.19320

---

## Production Architecture Patterns (2026)

Dominant hybrid: **vector + graph + episodic buffer**
- Vector for unstructured similarity (p95 latency: 1.44s)
- Graph for complex entity relationships (p95: 2.59s, +68.4% LLM score on multi-hop)
- Episodic for short-term working memory

**Best-fit by use case:**
- Simple chatbots: mem0
- Complex enterprise with changing states: Zep/Graphiti
- Multi-day autonomous agents: Letta
- Deep knowledge retrieval: Cognee
- Self-hosted, audit-required, Postgres-only: **memexai**

Source: https://machinelearningmastery.com/vector-databases-vs-graph-rag-for-agent-memory-when-to-use-which

---

## SurrealDB As An Optional Backend Track

- **What it is:** Open-source multi-model database covering relational, document, graph, full-text, vector, geospatial, and time-series workloads in one engine.
- **Why it matters for agent memory:** It can model the stack many memory systems eventually assemble from several services: documents, graph relationships, BM25/full-text search, and vector search.
- **JavaScript fit:** Official JavaScript SDK installs with `bun install surrealdb` / `npm install surrealdb`, supports ESM import via `import { Surreal } from "surrealdb"`, and can connect over WebSocket, HTTP, or embedded engines.
- **Search fit:** SurrealDB supports BM25 full-text indexes and HNSW vector indexes for approximate nearest-neighbor search. HNSW exposes tuning parameters such as `M` and `EFC`.
- **Operational caveat:** HNSW is memory-sensitive. SurrealDB docs explicitly call out the in-memory nature of HNSW and document bounded cache behavior via `SURREAL_HNSW_CACHE_SIZE` in v3.0.0.
- **Fit for memexai:** SurrealDB is a plausible experimental backend for advanced graph/vector deployments, not a launch default. Requiring it would weaken memexai's strongest wedge: "Postgres only, no vector store needed."
- **Recommended inclusion:** Add a future research track for a `SurrealStore` behind a storage interface, preserving the same file/revision/access-log contract. Graph/vector features should be opt-in extensions, not part of the stable default package.

Possible schema direction:

```sql
DEFINE TABLE memory_file SCHEMAFULL;
DEFINE FIELD path ON memory_file TYPE string;
DEFINE FIELD content_text ON memory_file TYPE string;
DEFINE FIELD user_id ON memory_file TYPE option<string>;

DEFINE ANALYZER memex_text TOKENIZERS class FILTERS lowercase,ascii;
DEFINE INDEX memory_file_content ON memory_file COLUMNS content_text FULLTEXT ANALYZER memex_text BM25;

DEFINE TABLE memory_chunk SCHEMAFULL;
DEFINE FIELD file ON memory_chunk TYPE record<memory_file>;
DEFINE FIELD text ON memory_chunk TYPE string;
DEFINE FIELD embedding ON memory_chunk TYPE array<float>;
DEFINE INDEX memory_chunk_embedding ON memory_chunk FIELDS embedding HNSW DIMENSION 1536 DIST COSINE TYPE F32;

DEFINE TABLE mentions TYPE RELATION FROM memory_file TO entity;
DEFINE TABLE supersedes TYPE RELATION FROM entity TO entity;
```

Sources:
- https://surrealdb.com/docs
- https://surrealdb.com/docs/languages/javascript/installation
- https://surrealdb.com/docs/languages/javascript/start
- https://surrealdb.com/docs/reference/query-language/statements/define/indexes
- https://surrealdb.com/docs/surrealdb/reference-guide/vector-search
