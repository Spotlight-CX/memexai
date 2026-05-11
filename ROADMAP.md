# memexai Roadmap

Memory as structured, inspectable files — reasoned over by a lightweight LLM agent, not retrieved by vector similarity. Same philosophy as how Claude Code navigates a codebase: give the model file tools and let it think.

---

## Phase 1 — Core agentic loop

### 1. `memex.add()` — agentic ingestion
Caller invokes `memex.add("user prefers red colour")` and the service handles the rest.

- Spins up a lightweight LLM (Claude Haiku / GPT-4o-mini / Gemini Flash — configurable)
- Harness: tool-use loop armed with `memory_list`, `memory_read`, `memory_write`, `memory_patch`
- Model reads the current index, decides which file to write to (or create), which heading to append under, and calls the appropriate tool
- Returns a structured result: file touched, operation type, confidence

### 2. Agentic retrieval
Caller invokes `memex.retrieve("what does the user prefer for colors?")` or `memex.getContextFor(query)`.

- Same lightweight model, read-only mode (`memory_list` + `memory_read` only — no write tools)
- Flow: model reads index → decides which files are relevant → reads them → returns a compiled context block
- No vector search. The model's reasoning is the retrieval engine

### 3. Smart index auto-maintenance
- After every `memex.add()` write, a post-write hook checks whether `user/index.md` / `shared/index.md` needs updating
- Small LLM call: given the new file or section, update the index entry
- Keeps the retrieval agent's navigation accurate without manual intervention

---

## Phase 2 — Scale and durability

### 4. BM25 keyword search
- Postgres `tsvector` on `mx_file.content_text`
- Used as a pre-filter for the retrieval agent: shortlist candidate files before the LLM reasons over them
- Exposed as an internal `memory_search` tool in the agentic harness

### 5. Memory compaction / summarization
- When a file exceeds a configurable token threshold, trigger a summarization run
- LLM reads the file, writes a condensed version, archives raw history in `mx_revision`
- Ensures every file stays within a single context window for the retrieval agent

---

## Phase 3 — Enterprise trust

### 6. Human memory editor in admin UI
- Admin can edit, delete, or rewrite any memory entry directly in the dashboard
- Builds on the existing revision trail — edits create a new revision with `actor: admin`

### 7. PII detection before write
- Scan ingestion content before storing; flag or redact detected PII
- Configurable policy: warn / redact / block

### 8. Multi-tenant namespace isolation
- Proper org/workspace scoping beyond the current `user/**` / `shared/**` split
- Required before any multi-customer deployment

---

## Out of scope (OSS edition)
- SSO / IAM
- Knowledge graph visualization
- Vector/semantic embeddings
