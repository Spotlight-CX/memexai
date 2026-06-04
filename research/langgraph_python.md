# LangGraph Python Example Research

Date: 2026-06-04

## Sources Read

- LangChain Python agents docs: `create_agent` is the recommended high-level agent harness; tools can be Python callables, LangChain tools, or tool dicts; local conversation persistence uses a checkpointer and `thread_id`.
- LangGraph prebuilt reference: `ToolNode` is the lower-level node for custom workflows, and the reference says standard ReAct-style agents should use `create_agent`. `create_react_agent` is documented as deprecated in favor of `langchain.agents.create_agent`.
- LangChain Google GenAI integration docs: use `langchain-google-genai`; the integration supports Gemini Developer API through API keys, checks `GOOGLE_API_KEY` first and `GEMINI_API_KEY` as fallback, and `ChatGoogleGenerativeAI` supports tool calling.
- MemexAI LangChain adapter docs: Python service-mode usage imports `MemexAI`, `get_langchain_tools`, and `ChatGoogleGenerativeAI`; the adapter exposes all seven MemexAI tools, with `memory_memorize` and `memory_search` recommended for most assistants.

## Version Rationale

- Python `>=3.10` because current LangChain/LangGraph v1 docs require Python 3.10 or newer.
- `langchain>=1.0,<2` and `langgraph>=1.0,<2` to stay on the current agent API while avoiding an unbounded future major.
- `langchain-google-genai>=4.0,<5` because the current docs describe the 4.x Google GenAI consolidation.
- `memexai` is installed from the local repo SDK with the `langchain` extra so the example uses the code being developed in this monorepo.

## Implementation Notes

- The example is service-mode only: `MemexAI(url=..., api_key=...)`, no database URL and no migrations in the Python process.
- The graph is built with `langchain.agents.create_agent`, which is the current LangGraph-backed ReAct harness. It consumes MemexAI's LangChain `StructuredTool` wrappers cleanly.
- The code narrows the MemexAI wrapper set to `memory_memorize` and `memory_search` for the smallest durable-memory loop.
- The system prompt is rebuilt for each turn so the second turn gets a fresh MemexAI prompt block after the first turn writes memory.
- A comment near `MEMEX_USER_ID` records that the value currently identifies the agent/user memory namespace in MemexAI and that the product term may change.
- A comment near the remember turn explains the production post-turn memorize pattern and duplicate-memory risk.
- Current LangChain v1 moved `StructuredTool` to `langchain_core.tools`; the example bridges that symbol locally before calling the current MemexAI adapter, whose import path still targets LangChain 0.2/0.3.

## Smoke Results

- `docker compose ps` showed an existing MemexAI service on `0.0.0.0:18080->8080/tcp`; `localhost:8080` was not bound.
- `GET http://localhost:18080/health` returned `{"ok":true}`.
- `memory_list` through the Python SDK succeeded before the run and reported 0 visible user files.
- Ran `python main.py` with `GEMINI_API_KEY`, `MEMEX_API_KEY`, and `MEMEX_ADMIN_SECRET` loaded from the ignored coordinator `.env`, overriding only `MEMEX_URL=http://localhost:18080`. Secrets were not printed.
- Remember turn response: "I've noted that you prefer 2BHK apartments near metro stations."
- Recall turn response: "You prefer 2BHK apartments located near metro stations."
- Post-run MemexAI SDK verification: `memory_list` reported 3 visible files and `memory_search("2BHK apartments near metro stations")` contained both `2BHK` and `metro`.
- Admin API verification: `/v1/admin/files` found 3 files for `langgraph_python_demo_user`.
- Syntax/import checks passed with Python 3.13: `python -m py_compile main.py` and imports for `create_agent`, `ChatGoogleGenerativeAI`, `InMemorySaver`, `MemexAI`, and `get_langchain_tools`.

## Gaps

- This example depends on a live Gemini key for the app model and, when `memory_memorize` is used, a MemexAI service configured with an LLM provider.
- The service's Docker Compose environment reads variables from the repository root, so setting `GEMINI_API_KEY` only in `examples/langgraph-python/.env` configures the app process but not an already-running service container.
- The example does not add automated tests because it is a live integration smoke example.
