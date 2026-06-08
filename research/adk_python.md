# Google ADK Python Research

## Docs read

- Google ADK Python quickstart: `https://google.github.io/adk-docs/get-started/python/`
- Google ADK memory guide: `https://google.github.io/adk-docs/sessions/memory/`
- Google ADK sessions/context guide: `https://google.github.io/adk-docs/sessions/`
- Local ADK 1.18.0 API inspection for `Runner`, `InMemorySessionService`, `BaseMemoryService`, `SearchMemoryResponse`, `MemoryEntry`, and `load_memory`.

## Versions selected

- `google-adk==1.18.0`
- Local MemexAI Python SDK through `-e ../../sdks/python`
- Python 3.10+ required by ADK docs and transitive ADK dependencies.

## Integration rationale

ADK has a first-class memory abstraction, so the example implements a small `BaseMemoryService` backed by MemexAI service calls instead of exposing direct memory tools as the primary interface.

- `add_session_to_memory(session)` extracts ADK session events and calls `memory_remember`.
- `search_memory(app_name, user_id, query)` calls `memory_context` and converts the answer/snippets into ADK `MemoryEntry` values.
- The recall agent uses ADK's built-in `load_memory` tool, keeping the example idiomatic for ADK users.

This path is preferable to direct tool ingestion because it maps MemexAI onto the ADK lifecycle: ADK session first, durable memory after the turn, ADK memory lookup in later turns.

## MemexAI gaps or missing primitives

- The MemexAI public API currently calls the namespace field `userId`/`user_id`; examples comment that this is the agent/user memory namespace and the term may change later.
- `memory_remember(dryRun=True)` exists and can help with duplicate checks, but there is no single high-level "post-turn memory policy" helper yet.
- A packaged `MemexAdkMemoryService` adapter would make ADK integration cleaner than copying this small class into each app.

## Smoke validation

Commands run:

```bash
cd examples/google-adk-python
python3.11 -m venv /tmp/memexai-adk-example-venv
/tmp/memexai-adk-example-venv/bin/python -m pip install -r requirements.txt
/tmp/memexai-adk-example-venv/bin/python -m py_compile src/main.py
MEMEX_URL=http://localhost:18080 MEMEX_API_KEY=<from .env> GEMINI_API_KEY=<from .env> /tmp/memexai-adk-example-venv/bin/python src/main.py smoke
MEMEX_URL=http://localhost:18080 MEMEX_API_KEY=<from .env> GEMINI_API_KEY=<from .env> /tmp/memexai-adk-example-venv/bin/python src/main.py inspect
```

Result:

- Remember turn acknowledged: `Atlas compliance review`.
- Recall turn answered: `Your onboarding checklist should include the Atlas compliance review.`
- Inspect returned `user/onboarding_checklist.md` with source-backed answer: `Atlas compliance review`.

Local notes:

- `docker compose ps` showed the MemexAI service published at `localhost:18080`.
- The coordinator shell did not export `GEMINI_API_KEY`, but the repo `.env` contains it. The live validation loaded it without printing secrets.
- The running container rejected the documented Docker default `dev-agent-key`; validation used the configured key from `.env`.
- ADK logged `Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY.` because the example maps `GEMINI_API_KEY` into `GOOGLE_API_KEY` for ADK compatibility.
