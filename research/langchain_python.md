# LangChain Python Example Research

Date: 2026-06-04

Scope: Worker 3, LangChain Python service-mode example only.

## Docs Read

- LangChain agents docs: `https://docs.langchain.com/oss/python/langchain/agents`
  - Current primary API is `create_agent`.
  - Agents take `model=`, `tools=`, and `system_prompt=`.
  - Invocation uses a state dict with `messages`.
- LangChain tools docs: `https://docs.langchain.com/oss/python/langchain/tools`
  - Tools are callable functions with typed inputs/outputs.
  - Tool names should stay provider-compatible; snake case is recommended.
- LangChain Google GenAI docs: `https://docs.langchain.com/oss/python/integrations/chat/google_generative_ai`
  - `ChatGoogleGenerativeAI` supports tool calling and native async.
  - Install package is `langchain-google-genai`.
  - Credentials can use `GEMINI_API_KEY`, with `GOOGLE_API_KEY` also supported by the integration.
  - `langchain-google-genai >= 3.1.0` is recommended for Gemini thought-signature handling in multi-turn tool-call conversations.
- LangChain Google GenAI API reference: `https://reference.langchain.com/python/langchain-google-genai/chat_models/ChatGoogleGenerativeAI`
  - Latest observed reference version: `langchain-google-genai` 4.2.x.
  - The integration uses the consolidated `google-genai` SDK as of 4.0.0.
- PyPI package pages / JSON:
  - `langchain==1.3.4`, released 2026-06-02, requires Python >=3.10.
  - `langchain-google-genai==4.2.4`.
  - `langchain-core==1.4.0`.
  - `langgraph==1.2.4`.

## Existing MemexAI Context

- `apps/website/content/docs/adapters/langchain.mdx` shows Python usage with:
  - `MemexAI(url="http://localhost:8080", api_key="dev-agent-key")`
  - `memex.for_user("user_123", actor="assistant")`
  - `get_langchain_tools(user)`
  - `ChatGoogleGenerativeAI`
- `sdks/python/memexai/adapters/langchain.py` returns LangChain `StructuredTool` objects.
- The adapter exposes all MemexAI memory tools. The example filters to:
  - `memory_memorize`
  - `memory_search`
- `sdks/python/memexai/client.py` is the service-mode HTTP client. It exposes:
  - `get_prompt_block()` / `get_system_prompt()`
  - `list_files()`
  - `search()`
  - `memorize()`

## Version Rationale

- Use Python >=3.10 because LangChain 1.3.4 requires it.
- Pin `langchain==1.3.4` and `langchain-google-genai==4.2.4` for a reproducible example against the latest packages observed on 2026-06-04.
- Use `create_agent` instead of the older `create_tool_calling_agent` because current LangChain docs describe `create_agent` as the simple agent harness.
- Keep `memexai` installed from `../../sdks/python[langchain]` so the example exercises this checkout's adapter without writing outside the owned example scope.

## Design Rationale

- Service mode only: the example never opens a Postgres connection and never calls `migrate()`.
- `MEMEX_URL` defaults to `http://localhost:8080`, matching MemexAI docs.
- README tells users to run `docker compose ps` because the host port may be changed through Compose env.
- `MEMEX_API_KEY` defaults to `dev-agent-key`, matching Compose defaults.
- `MEMEX_USER_ID` defaults to `langchain_python_demo_user` so repeated remember/recall runs reuse the same durable namespace.
- `GEMINI_API_KEY` is required for the example model. It must also be provided to the MemexAI service for LLM-backed `memory_memorize`.
- Comments call out the post-turn memorize pattern and duplicate-memory risk without implementing extra direct writes that would obscure the LangChain tool-calling path.

## Gaps / Caveats

- `memory_memorize` returns `MODEL_NOT_CONFIGURED` if the MemexAI service container was started without model credentials.
- The model controls the exact response wording. Smoke validation should check for the durable fact, not exact prose.
- The local Python SDK package is not pulled from PyPI because this repo owns the adapter being demonstrated.
- In LangChain 1.3.4, `langchain.tools` exists but no longer exposes `StructuredTool`; the canonical import is `langchain_core.tools.StructuredTool`. The example applies a small local shim before calling the existing MemexAI adapter, because this worker's owned write scope does not include SDK adapter changes.

## Smoke Commands / Results

Planned commands:

```bash
cd /Users/soorajsanker/projects/propx/memexai-langchain-python
set -a
source examples/langchain-python/.env
set +a
docker compose ps
curl -s "$MEMEX_URL/health"
curl -s -X POST "$MEMEX_URL/v1/tools/memory_list/execute" \
  -H "Authorization: Bearer ${MEMEX_API_KEY:-dev-agent-key}" \
  -H "Content-Type: application/json" \
  -d "{\"context\":{\"userId\":\"${MEMEX_USER_ID:-langchain_python_demo_user}\",\"actor\":\"smoke\"},\"arguments\":{\"prefix\":\"user/\"}}"
cd examples/langchain-python
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m py_compile app.py
python app.py
```

Observed results:

- `docker compose ps` in this checkout showed Compose using the local env mapping; the reachable service URL was `http://localhost:18080`.
- `/health` returned `{"ok":true}` from `http://localhost:18080/health`.
- `memory_list` before the smoke run returned `{"files":[]}` for `langchain_python_demo_user`.
- `python -m pip install -r requirements.txt` completed with:
  - `memexai-0.1.0` editable from `../../sdks/python`
  - `langchain-1.3.4`
  - `langchain-google-genai-4.2.4`
  - `langchain-core-1.4.0`
  - `langgraph-1.2.4`
- `python -m py_compile app.py` passed.
- Import check passed for:
  - `create_agent`
  - `ChatGoogleGenerativeAI`
  - `MemexAI`
  - `get_langchain_tools`
- `python app.py` output:

```text
MemexAI service: http://localhost:18080
User namespace: langchain_python_demo_user

Turn 1 - remember
Assistant: I've remembered that you prefer 2BHK apartments near metro stations.

Turn 2 - recall
Assistant: You prefer 2BHK apartments near metro stations.

MemexAI inspection
- API files: {'files': [{'path': 'user/index.md', 'size': 71, 'updatedAt': '2026-06-04T07:50:37.121Z'}, {'path': 'user/log.md', 'size': 151, 'updatedAt': '2026-06-04T07:50:39.879Z'}, {'path': 'user/profile.md', 'size': 62, 'updatedAt': '2026-06-04T07:50:33.929Z'}]}
- Admin UI: http://localhost:18080/admin
```

- Direct service verification after the run:
  - `memory_read user/profile.md` returned `# User Profile\n\n- Prefers 2BHK apartments near metro stations.`
  - `memory_search "What apartment type and location does this user prefer?"` returned answer `The user prefers 2BHK apartments located near metro stations.` with source `user/profile.md`.
