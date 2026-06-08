# MemexAI + Google ADK Python

This terminal example shows Google ADK using MemexAI as the durable memory backend in service mode.

ADK owns the agent loop. MemexAI owns the memory namespace, search, revisions, and admin visibility.

## 1. Start MemexAI

From the repo root:

```bash
docker compose up -d
docker compose ps
```

The documented default service URL is `http://localhost:8080`. On some local Docker setups the published port may differ; this machine exposed the service at `http://localhost:18080`.

## 2. Create an environment

```bash
cd examples/google-adk-python
python3.10 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

ADK currently requires Python 3.10 or newer.

## 3. Configure

```bash
export MEMEX_URL=http://localhost:8080
export MEMEX_API_KEY=dev-agent-key
export MEMEX_USER_ID=adk_demo_user
export GEMINI_API_KEY=...
```

`MEMEX_USER_ID` is the current MemexAI field for the agent/user memory namespace. That term may change later, so treat it as an integration identifier rather than final product language.

Optional:

```bash
export GEMINI_MODEL=gemini-2.5-flash
```

## 4. Run the two turns

Save a durable fact:

```bash
python src/main.py remember
```

Ask ADK to recall it through MemexAI:

```bash
python src/main.py recall
```

Or run both in one command:

```bash
python src/main.py smoke
```

Expected recall output should mention `Atlas compliance review`.

## 5. Inspect memory

From the terminal:

```bash
python src/main.py inspect
```

Or call the service API directly:

```bash
curl -s -X POST "$MEMEX_URL/v1/tools/memory_search/execute" \
  -H "authorization: Bearer $MEMEX_API_KEY" \
  -H "content-type: application/json" \
  -d '{
    "context": {"userId": "adk_demo_user", "actor": "manual-inspect"},
    "arguments": {"query": "onboarding checklist"}
  }' | python -m json.tool
```

The admin UI is available at `$MEMEX_URL/admin` when the service container includes it.

## Why this shape

ADK has a native memory-service abstraction. This example implements a small `BaseMemoryService` adapter:

- `add_session_to_memory` sends completed ADK session text to `memory_memorize`.
- `search_memory` maps ADK's memory lookup to `memory_search`.
- ADK's built-in `load_memory` tool remains the recall surface for the agent.

That is more idiomatic for ADK than handing the model raw MemexAI tools for every turn. Raw file tools are still useful when an agent must control exact files such as `user/profile.md`, but most apps should start with `memory_memorize` and `memory_search`.

For production post-turn memory, save only durable facts after meaningful interactions. Avoid writing every turn. For noisy apps, search first or use `memory_memorize` with `dryRun` when available to reduce duplicates. Deeper duplicate reduction can be handled by a later consolidation pass.
