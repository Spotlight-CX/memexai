# MemexAI + LangChain Python

This example shows three ways to fit MemexAI into a real LangChain agent created with `create_agent(...)`.

LangChain/LangGraph users usually think about memory in two layers:

- `checkpointer` / thread state: short-term conversation memory for one thread.
- `store` / LangMem tools: long-term memory managed through tools or background workflows.

MemexAI maps to the long-term memory layer, but with a different backing model: service-backed markdown files, revisions, access logs, admin inspection, and `user/` / `shared/` scopes.

## Three Paths

| Path | Agent sees | Best for |
|---|---|---|
| Hot subagent | `memory_remember`, `memory_context` | Default durable memory without file decisions |
| Hot raw | Schema-safe raw subset: `memory_write`, `memory_read`, `memory_find` | Agents that should own file layout and exact paths |
| Background | App tools only; app calls `memory.remember(...)` after the turn | Latency, dedupe, review, and tool-result learning |

### Hot Path: Subagent

Run:

```bash
python hot_path_subagent.py
```

The LangChain main agent gets MemexAI's in-house memory subagent as tools. The main agent decides *when* to remember or retrieve, while MemexAI decides what is durable and where it belongs.

This is the closest MemexAI equivalent to a LangMem-style `create_manage_memory_tool` plus search tool, except MemexAI routes into inspectable files with revisions and access logs.

### Hot Path: Raw Tools

Run:

```bash
python hot_path_raw.py
```

The LangChain main agent gets a schema-safe subset of raw file/search tools and directly manages paths such as `user/preferences.md`.

Use this when the app has a known memory schema and you want the model to operate on explicit files. It is more powerful, but it gives the main agent more responsibility.

### Background Path

Run:

```bash
python background_path.py
```

The LangChain agent only sees an app tool (`run_sql`). After the response, application code inspects the tool result, extracts a compact durable insight, and calls `memory.remember(...)`.

Use this when learning can happen after the response, or when you want batching, dedupe, review, cheaper extraction, or stricter filtering of raw tool outputs.

## LangMem Comparison

- LangMem `create_manage_memory_tool` is conceptually closest to MemexAI `memory_remember`.
- LangMem `create_search_memory_tool` is conceptually closest to MemexAI `memory_context` or `memory_find`.
- LangMem tools operate over a LangGraph `BaseStore`.
- MemexAI operates over a service-backed memory namespace with human-readable files, revisions, access logs, and admin UI.
- A LangGraph `BaseStore` adapter could be added later, but this example intentionally uses first-party MemexAI tools instead.

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
python hot_path_subagent.py
python hot_path_raw.py
python background_path.py
python app.py
```

`app.py` remains a compact remember/recall smoke test. The path-specific files are the recommended learning examples.

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

## Shared Systemic Insights

The background path is a natural place to learn operational facts such as SQL dialect quirks or API limitations. To route those into shared memory for trusted agents:

1. Add a routing entry in `shared/index.md`, such as `shared/tool-quirks.md`.
2. Enable `MEMEX_SHARED_WRITE_MODE=rw` on the service.

Keep user-private facts in `user/`. Shared writable mode is off by default.
