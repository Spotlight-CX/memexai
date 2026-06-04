# CrewAI Python Service-Mode Example Research

Date: 2026-06-04

## Sources Read

- CrewAI LLM docs: https://docs.crewai.com/en/concepts/llms
- CrewAI agents docs: https://docs.crewai.com/en/concepts/agents
- CrewAI tasks docs: https://docs.crewai.com/en/concepts/tasks
- CrewAI tools docs: https://docs.crewai.com/en/concepts/tools
- MemexAI CrewAI adapter docs: `apps/website/content/docs/adapters/crewai.mdx`
- MemexAI Python SDK README: `sdks/python/README.md`
- MemexAI CrewAI adapter implementation: `sdks/python/memexai/adapters/crewai.py`

## Findings

- CrewAI docs were showing v1.14.5. The LLM docs describe direct `LLM(model="...")` configuration and provider-specific environment variables.
- For Google Gemini, CrewAI documents `GEMINI_API_KEY` or `GOOGLE_API_KEY`, with `LLM(model="gemini/gemini-2.5-flash", api_key="...")` style usage.
- CrewAI agents accept `tools=[...]`; tasks are assignments performed by agents; crews orchestrate tasks with a process such as sequential execution.
- CrewAI tools can be built with `crewai.tools.tool`, and the docs state async tools work in standard crews and with `kickoff_async()`.
- The local MemexAI CrewAI adapter returns seven `@tool`-decorated async tools. For this example, the CLI filters those down to `memory_memorize` and `memory_search`.
- MemexAI service-mode Python usage is `MemexAI(url="http://localhost:8080", api_key="dev-agent-key")` followed by `for_user(...)`.
- LLM-backed `memory_memorize` runs on the MemexAI service, not in the Python SDK. The Docker service receives `GEMINI_API_KEY` and defaults `MEMEX_API_KEY` to `dev-agent-key`.

## Version Choice

- `crewai[google-genai]>=1.14.5,<2.0`
- `python-dotenv>=1.0.1`
- `httpx>=0.27.0`
- local editable MemexAI Python SDK via `-e ../../sdks/python[crewai]`

This keeps the example on CrewAI's current documented 1.x API while avoiding a floating 2.x upgrade. Local validation resolved CrewAI 1.14.6, while the docs site read during implementation displayed v1.14.5.

## Implementation Rationale

The example is service-mode only. It never uses `create_memex()` or a Postgres URL from Python. The only MemexAI connection settings are `MEMEX_URL`, `MEMEX_API_KEY`, and `MEMEX_USER_ID`.

The CLI checks `get_crewai_tools(memory)` so it exercises the repo's adapter surface and confirms that `memory_memorize` and `memory_search` exist. It keeps the public agent surface to those two tools because MemexAI guidance recommends `memory_memorize` for durable writes and `memory_search` for recall.

CrewAI documents async tool support, and the local adapter returns async functions. In local smoke testing, the adapter worked for the remember turn, but the script then hit `RuntimeError: Event loop is closed` when making a post-turn MemexAI HTTP call after `kickoff_async()`. The example therefore uses practical synchronous CrewAI wrappers that call the same MemexAI service methods with short-lived clients.

A post-turn `memory.memorize(...)` call is included after the remember turn. This is a practical smoke-test guardrail: CrewAI may produce a natural-language confirmation without reliably choosing the memory tool on every model run. The tradeoff is duplicates on repeated runs, so the README calls that out.

## Smoke Plan

1. Start or discover the service with `docker compose ps`.
2. Confirm health with `curl -s http://localhost:8080/health`.
3. Confirm API auth and user scope with `memory_list`.
4. Run `python main.py` with `.env` loaded and without printing secrets.
5. Verify recall contains `2BHK` and `metro`.
6. Verify stored memory with `memory_search` or the admin UI.
7. Run Python syntax/import checks.

## Smoke Results

- Python syntax: `python3 -m py_compile main.py` passed before dependency install; `.venv/bin/python -m py_compile main.py` passed after install.
- Import check: CrewAI, dotenv, httpx, MemexAI, and `get_crewai_tools` imported successfully. CrewAI resolved to 1.14.6.
- Service discovery: `docker compose ps` showed MemexAI mapped to `0.0.0.0:18081->8080/tcp` for the isolated worktree validation run; docs default remains `http://localhost:8080`.
- Health: `curl -s http://localhost:18081/health` returned `{"ok":true}`.
- Agent API: `memory_list` initially returned `{"files":[]}` for `crewai_python_service_demo`.
- CLI: `python main.py` remembered and recalled `2BHK apartments near metro stations`.
- Service verification: CLI `memory_search` returned `user/housing_preferences.md` with a highlighted `2BHK apartments near metro stations` snippet and a grounded answer.
- Admin API: `/v1/admin/files?prefix=users/crewai_python_service_demo` returned `housing_preferences.md`, `index.md`, and `log.md`.

## Gaps

- `memory_memorize` requires a configured service model; if Compose was started without `GEMINI_API_KEY`, the example will fail with `MODEL_NOT_CONFIGURED`.
- Re-running the same terminal demo can create equivalent memory facts because both the agent and the post-turn guardrail may save the turn.
- This example does not cover CrewAI YAML project scaffolding, flows, or multi-agent collaboration. It is intentionally a minimal terminal example.
