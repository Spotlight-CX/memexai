# MemexAI + LangGraph Python

Tiny terminal example for a LangGraph-backed Python agent that uses MemexAI in container service mode only.

The example uses LangChain's current `create_agent` harness, which is built on LangGraph and uses tool execution internally. LangGraph's older prebuilt `create_react_agent` remains available but is now documented as deprecated in favor of `langchain.agents.create_agent` for standard ReAct-style agents.

## Setup

Start the MemexAI service from the repository root:

```bash
docker compose up -d
docker compose ps
```

The docs default is `MEMEX_URL=http://localhost:8080`. If `docker compose ps` shows a different published port, set `MEMEX_URL` in `.env`.

Create the Python environment:

```bash
cd examples/langgraph-python
python3.10 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `GEMINI_API_KEY`. Do not print it in logs.

Defaults:

```bash
MEMEX_URL=http://localhost:8080
MEMEX_API_KEY=dev-agent-key
MEMEX_USER_ID=langgraph_python_demo_user
GEMINI_MODEL=gemini-2.5-flash
```

`MEMEX_ADMIN_SECRET=dev-admin-secret` enables the optional admin-file verification against the Docker Compose service.

## Run

```bash
python main.py
```

The CLI performs:

1. `GET /health`
2. `memory_list` through the MemexAI Python SDK
3. A remember turn: stores `2BHK apartments near metro stations`
4. A recall turn: answers from durable memory
5. Optional `/v1/admin/files` verification when `MEMEX_ADMIN_SECRET` is set

This example exposes the MemexAI LangChain wrappers for `memory_remember` and `memory_context`. A production app may also run a post-turn memorize pass over accepted user messages; if it does, search first or rely on consolidation so retries do not create noisy duplicate facts.

## Notes

- This project intentionally does not use direct Postgres mode. The Python process only talks to the MemexAI HTTP service.
- `GEMINI_API_KEY` is used by the app's Gemini model. If you want the service's LLM-backed `memory_remember` path to use Gemini too, start Docker Compose with `GEMINI_API_KEY` exported in the repository root environment or root `.env`.
- The stable default user id keeps repeated local runs in the same MemexAI namespace so the recall turn can prove persistence.
