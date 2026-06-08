# MemexAI + CrewAI Python

This example is a terminal-only CrewAI project that uses the MemexAI container service. It does not use direct Postgres credentials from Python.

It runs two turns:

1. Remember: saves `I prefer 2BHK apartments near metro stations.`
2. Recall: asks CrewAI to search MemexAI memory and answer from the stored preference.

## Requirements

- Python 3.10, 3.11, 3.12, or 3.13
- Docker Compose running the MemexAI service
- `GEMINI_API_KEY`

CrewAI docs currently show v1.14.5 and Gemini support through `GEMINI_API_KEY` or `GOOGLE_API_KEY`, so this example uses `crewai[google-genai]>=1.14.5,<2.0`.

## Setup

From the repository root:

```bash
docker compose up -d
docker compose ps
```

The docs default service URL is `http://localhost:8080`, but `docker compose ps` is the source of truth if you changed `MEMEX_PORT`.

Then install the example:

```bash
cd examples/crewai-python
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `GEMINI_API_KEY`. Defaults:

```bash
MEMEX_URL=http://localhost:8080
MEMEX_API_KEY=dev-agent-key
MEMEX_USER_ID=crewai_python_service_demo
```

If the Docker service should run model-backed `memory_remember`, pass the same Gemini key to Compose before starting or recreating the service:

```bash
GEMINI_API_KEY=... docker compose up -d --build
```

## Run

```bash
python main.py
```

Optional arguments override the remembered fact and recall question:

```bash
python main.py "I prefer 2BHK apartments near metro stations." "What apartment preference should you remember for me?"
```

The program prints the CrewAI remember response, the post-turn MemexAI write summary, the CrewAI recall response, and a service-side verification payload from `memory_list` and `memory_context`.

## Rationale

The example checks the existing `memexai.adapters.crewai.get_crewai_tools()` adapter and confirms the memory subagent tools are available: `memory_remember` and `memory_context`. That matches the MemexAI prompt block guidance and keeps the agent away from raw file bookkeeping.

CrewAI documents async tool support in standard crews. In local smoke testing with CrewAI 1.14.6, the async adapter worked for the remember turn, but the terminal flow hit an `Event loop is closed` error when the script immediately performed post-turn MemexAI verification with the same async HTTP client. The CLI therefore uses small synchronous CrewAI tool wrappers around the same MemexAI service methods, with short-lived clients per tool call.

The extra post-turn `memory.remember(...)` call is deliberate. It makes a terminal smoke test deterministic even if the LLM replies before selecting a tool. In a production chat loop, post-turn saves should dedupe against prior turn text or inspect MemexAI write results, because repeated runs can append equivalent facts.

## Smoke Checks

```bash
curl -s "$MEMEX_URL/health"

curl -s -X POST "$MEMEX_URL/v1/tools/memory_list/execute" \
  -H "Authorization: Bearer ${MEMEX_API_KEY:-dev-agent-key}" \
  -H "Content-Type: application/json" \
  -d '{"context":{"userId":"crewai_python_service_demo","actor":"smoke"},"arguments":{"prefix":"user/"}}'
```

After running the CLI, inspect memory in the admin UI:

```bash
open "${MEMEX_URL:-http://localhost:8080}/admin"
```

or use the same service API with `memory_context`.

## Current Gaps

- The service must have an LLM configured for `memory_remember`; without it, MemexAI returns `MODEL_NOT_CONFIGURED`.
- CrewAI package resolution is still moving quickly, so this example caps CrewAI below 2.0 and records the tested version in `research/crewai_python.md`.
- The post-turn memorize guardrail can create duplicate or near-duplicate memory entries on repeated runs.
