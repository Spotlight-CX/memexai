# LlamaIndex Python Example Research

Date: 2026-06-04

## Docs Read

- LlamaIndex Google GenAI integration: `https://docs.llamaindex.ai/en/stable/examples/llm/google_genai/`
- LlamaIndex multi-agent/function-agent docs: `https://docs.llamaindex.ai/en/stable/understanding/agent/multi_agent/`
- Google Gemini API docs: `https://ai.google.dev/gemini-api/docs`
- Google Gemini model docs: `https://ai.google.dev/models/gemini`
- MemexAI LlamaIndex adapter docs: `apps/website/content/docs/adapters/llamaindex.mdx`
- MemexAI Python SDK docs: `sdks/python/README.md`
- MemexAI adapter source: `sdks/python/memexai/adapters/llamaindex.py`

## Versions

Checked with `python3 -m pip index versions` on 2026-06-04:

- `llama-index-core==0.14.16`
- `llama-index-llms-google-genai==0.7.4`
- `python-dotenv==1.2.1`
- local editable `memexai` SDK from `../../sdks/python[llamaindex]`

## Rationale

The current LlamaIndex docs use `GoogleGenAI` from `llama_index.llms.google_genai` and show tool/function calling with `FunctionTool.from_defaults`. Their agent workflow docs show `FunctionAgent` from `llama_index.core.agent.workflow`, with `await agent.run(user_msg=...)`.

The Google Gemini docs currently highlight newer quickstart model names, while LlamaIndex's stable Google GenAI page demonstrates `gemini-2.5-flash`. The example defaults to `gemini-2.5-flash` because it is still listed as a stable Gemini model and is the latest model family verified in the current LlamaIndex integration examples. Users can override it with `GEMINI_MODEL`.

The MemexAI Python adapter already returns LlamaIndex `FunctionTool` objects. The example filters that list to `memory_memorize` and `memory_search`, matching MemexAI's own prompt guidance that these two agentic tools are the preferred default.

The CLI requires `GEMINI_API_KEY` and passes it explicitly to `GoogleGenAI`. It also removes any ambient `GOOGLE_API_KEY` from the process to avoid the Google SDK warning that appears when both variables are set.

## Gaps

- MemexAI's website adapter snippet still references older LlamaIndex/Gemini import paths. This example uses the current `GoogleGenAI` integration instead.
- Gemini model availability can vary by Google account, region, and quota. `GEMINI_MODEL` is configurable for that reason.
- The adapter returns all raw and agentic tools; this example filters to the agentic pair in app code rather than changing the adapter API.

## Smoke Results

Ran locally on 2026-06-04 from `examples/llamaindex-python`.

- `docker compose ps`: no service on this worktree's default `8080`; an existing MemexAI service was already published on `localhost:18080`. Another worker owned port `5433`, so this smoke used `MEMEX_URL=http://localhost:18080` from local `.env`.
- `/health`: `HTTP/1.1 200 OK`, body `{"ok":true}`.
- `memory_list` through `/v1/tools/memory_list/execute`: `200`, initially `{"files":[]}` for `llamaindex_python_demo_user`.
- Dependency install: Python 3.11 venv, upgraded pip, then `python -m pip install -r requirements.txt`.
- Syntax check: `.venv/bin/python -m py_compile main.py` passed.
- Import check: imported `FunctionAgent`, `GoogleGenAI`, `MemexAI`, and `get_llamaindex_tools` successfully.
- CLI smoke: `.venv/bin/python main.py` printed:
  - Turn 1: `I have remembered that your preferred apartment configuration is a 2BHK with morning sunlight.`
  - Turn 2: `You prefer a 2BHK apartment configuration with morning sunlight.`
  - Files: `user/index.md`, `user/log.md`, `user/profile.md`.
- Service API verification: `memory_read` for `user/profile.md` returned:

```markdown
## Apartment Preferences
- Preferred configuration: 2BHK
- Sunlight: Morning sunlight
```

- Admin API verification:
  - `/v1/admin/files` included `users/llamaindex_python_demo_user/index.md`, `users/llamaindex_python_demo_user/log.md`, and `users/llamaindex_python_demo_user/profile.md`.
  - `/v1/admin/revisions?userId=llamaindex_python_demo_user` included `Preferred configuration: 2BHK` and `Morning sunlight`.
