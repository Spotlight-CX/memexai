# MemexAI + LlamaIndex Python

Minimal terminal example for LlamaIndex Python using the MemexAI container service, Gemini, and the MemexAI LlamaIndex adapter.

The app runs two turns:

1. Remember a durable apartment preference.
2. Recall it through MemexAI memory search.

## Requirements

- Python 3.10+
- Docker Compose MemexAI service
- A Gemini API key from Google AI Studio

Start MemexAI from the repository root:

```bash
docker compose up -d
docker compose ps
```

The docs default service URL is `http://localhost:8080`. If `docker compose ps` shows a different published port, set `MEMEX_URL` in `.env`.

## Setup

```bash
cd examples/llamaindex-python
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set:

```bash
GEMINI_API_KEY=...
```

Defaults:

- `MEMEX_URL=http://localhost:8080`
- `MEMEX_API_KEY=dev-agent-key`
- `MEMEX_USER_ID=llamaindex_python_demo_user`
- `GEMINI_MODEL=gemini-2.5-flash`

## Run

```bash
python main.py
```

The script checks `/health`, checks `memory_list` through the service API, runs the two agent turns, and prints the user memory files visible to the demo user.

To inspect memory directly:

```bash
curl -s -X POST "$MEMEX_URL/v1/tools/memory_list/execute" \
  -H "authorization: Bearer ${MEMEX_API_KEY:-dev-agent-key}" \
  -H "content-type: application/json" \
  -d '{"context":{"userId":"llamaindex_python_demo_user","actor":"manual-check"},"arguments":{"prefix":"user/"}}'
```

## Notes

This example exposes only the agentic MemexAI tools from the LlamaIndex adapter:

- `memory_memorize`
- `memory_search`

The full adapter also supports raw file tools, but the agentic pair is enough for the remember/recall flow and keeps file bookkeeping inside MemexAI.

The app also performs an explicit post-turn `memory.memorize(...)` after the remember turn. That pattern is useful in production chat loops because durable facts can be captured even if the LLM answers without choosing the memorize tool. MemexAI may reduce duplicates by no-oping or merging when the same fact has already been stored.
