# MemexAI LangChain Python Example

Terminal example for using LangChain Python with the containerized MemexAI service.

The CLI runs two turns against Gemini:

1. Remember: the agent stores a durable preference through `memory_remember`.
2. Recall: a second turn asks the agent to retrieve that preference through `memory_context`.

This example uses service mode only. Start MemexAI with Docker Compose; the Python app talks to the HTTP API at `MEMEX_URL`.

## Setup

From the repository root:

```bash
cp examples/langchain-python/.env.example examples/langchain-python/.env
```

Edit `examples/langchain-python/.env` and set:

```bash
GEMINI_API_KEY=...
```

The defaults are:

```bash
MEMEX_URL=http://localhost:8080
MEMEX_API_KEY=dev-agent-key
MEMEX_USER_ID=langchain_python_demo_user
GEMINI_MODEL=gemini-2.5-flash
```

Start MemexAI with the same Gemini key available to the container. `memory_remember` runs in the service, so the service needs model credentials too.

```bash
set -a
source examples/langchain-python/.env
set +a
docker compose up -d
docker compose ps
```

If Compose maps a different host port, update `MEMEX_URL` to match the `memexai` service in `docker compose ps`.

## Install

Use Python 3.10 or newer. From `examples/langchain-python`:

```bash
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

The requirements install the local `sdks/python` package in editable mode so the example follows this checkout.

## Run

```bash
python app.py
```

You can override the demo text:

```bash
python app.py \
  --remember "Remember that I prefer 2BHK apartments near metro stations." \
  --recall "What apartment type and location do I prefer?"
```

Expected output looks like:

```text
MemexAI service: http://localhost:8080
User namespace: langchain_python_demo_user

Turn 1 - remember
Assistant: I will remember that you prefer 2BHK apartments near metro stations.

Turn 2 - recall
Assistant: You prefer 2BHK apartments near metro stations.

MemexAI inspection
- API files: ...
- Admin UI: http://localhost:8080/admin
```

Exact wording varies by model, but the recall should include `2BHK` and `metro`.

## Inspect Memory

Check service health:

```bash
curl -s "$MEMEX_URL/health"
```

List the demo user's memory files:

```bash
curl -s -X POST "$MEMEX_URL/v1/tools/memory_list/execute" \
  -H "Authorization: Bearer ${MEMEX_API_KEY:-dev-agent-key}" \
  -H "Content-Type: application/json" \
  -d "{\"context\":{\"userId\":\"${MEMEX_USER_ID:-langchain_python_demo_user}\",\"actor\":\"curl\"},\"arguments\":{\"prefix\":\"user/\"}}"
```

Open the admin console:

```text
http://localhost:8080/admin
```

Use the admin secret from Compose, default `dev-admin-secret`.

## Rationale

- `MEMEX_URL` defaults to the docs service URL, `http://localhost:8080`.
- `MEMEX_API_KEY` defaults to the Docker development key, `dev-agent-key`.
- `MEMEX_USER_ID` is stable by default so repeated runs show persistent memory.
- `GEMINI_API_KEY` is required because both the example agent and service-backed `memory_remember` need an LLM.
- The LangChain adapter exposes all MemexAI tools; this example passes only `memory_remember` and `memory_context` to keep the agent on the recommended memory subagent path.
- The first turn asks the agent to store a fact. In a production chat app, you may instead run `memory_remember` after a user turn or completed exchange. That post-turn pattern is convenient, but it should be gated to avoid feeding the same fact repeatedly and creating duplicate memory churn.
