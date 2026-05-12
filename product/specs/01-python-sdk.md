# Spec: Python SDK

**Priority:** Tier 1 — blocking launch  
**Package name:** `memexai` on PyPI  
**Status:** Not started

---

## Why

60%+ of the AI agent ecosystem is Python. LangChain, LlamaIndex, CrewAI, AutoGen, Pydantic AI, and smolagents are all Python-first. mem0's Python SDK is their primary adoption driver. Without a Python SDK, memexai is invisible to the majority of developers building agents.

No Python SDK = can only reach TypeScript/JavaScript developers = miss the larger market.

---

## What It Is

A direct-Postgres Python client that mirrors `@memexai/core` exactly. Same path logic, same schema, same migrations inlined as strings. No HTTP service required.

**Install:**
```bash
pip install memexai
```

---

## API Design

Mirrors `@memexai/core` naming conventions translated to Python style:

```python
import asyncio
import os
from memexai import create_memex

async def main():
    memex = create_memex(os.environ["DATABASE_URL"])
    await memex.migrate()  # idempotent, safe to call every startup

    user = memex.for_user(user_id="user_123", actor="assistant")
    prompt_block = await user.get_prompt_block()

    # Write
    await user.write("user/profile.md", "# Profile\n\n- Prefers quiet neighborhoods", reason="Initial profile")

    # Read
    file = await user.read("user/profile.md")
    print(file.content)

    # List
    files = await user.list("user/")

    # Patch (append under heading)
    await user.patch("user/profile.md", operation="append_lines",
                     after_heading="## Preferences", lines=["- Prefers 2BHK"])

    await memex.close()

asyncio.run(main())
```

---

## Class Hierarchy

```python
class Memex:
    def __init__(self, pool: asyncpg.Pool): ...
    async def migrate(self) -> None: ...
    def get_tools(self) -> list[ToolDefinition]: ...
    async def execute_tool(self, tool_name: str, args: dict, ctx: ToolContext) -> Any: ...
    async def get_prompt_block(self, ctx: ToolContext) -> str: ...
    def for_user(self, *, user_id: str, actor: str = "assistant") -> MemexUser: ...
    def add_hook(self, event: Literal["before_write"], fn: HookFn) -> "Memex": ...  # fluent
    async def close(self) -> None: ...

class MemexUser:
    async def get_prompt_block(self) -> str: ...
    async def list(self, prefix: str | None = None) -> ListResult: ...
    async def read(self, path: str) -> ReadResult: ...
    async def write(self, path: str, content: str, reason: str | None = None) -> WriteResult: ...
    async def patch(self, path: str, *, operation: str, ...) -> PatchResult: ...
    async def execute_tool(self, tool_name: str, args: dict, tool_call_id: str | None = None) -> Any: ...

def create_memex(database_url: str) -> Memex:
    pool = asyncpg.create_pool(database_url)  # lazy connect
    return Memex(pool)
```

---

## Framework Adapters

### LangChain

```python
from memexai.adapters.langchain import create_langchain_tools
from langchain.agents import create_react_agent

tools = create_langchain_tools(user)
agent = create_react_agent(llm, tools, prompt)
```

Adapter wraps each tool as a `StructuredTool` with Pydantic input schemas matching the existing JSON Schema definitions.

### LlamaIndex

```python
from memexai.adapters.llamaindex import create_llamaindex_tools
from llama_index.core.agent import ReActAgent

tools = create_llamaindex_tools(user)
agent = ReActAgent.from_tools(tools, llm=llm)
```

Adapter returns `FunctionTool` instances.

### CrewAI

```python
from memexai.adapters.crewai import create_crewai_tools
from crewai import Agent

memory_tools = create_crewai_tools(user)
agent = Agent(role="...", tools=memory_tools)
```

---

## File Structure

```
sdks/python/
  pyproject.toml
  README.md
  memexai/
    __init__.py          # create_memex, Memex, MemexUser, MemexError
    _db.py               # asyncpg pool wrapper, connection management
    _migrations.py       # inline SQL strings (same as TS migrations.ts)
    _tools.py            # tool execution logic (mirrors tools.ts exactly)
    _paths.py            # virtual_to_physical, assert_writable, etc.
    _prompt_block.py     # build_prompt_block
    _hooks.py            # HookRegistry, HookFn type
    _pii.py              # create_pii_redact_hook (see spec 04)
    errors.py            # MemexError
    types.py             # ToolContext, ToolDefinition, ReadResult, etc.
    adapters/
      __init__.py
      langchain.py
      llamaindex.py
      crewai.py
  tests/
    test_paths.py
    test_tools.py
    test_migrations.py
    test_adapters.py
```

---

## Technical Requirements

- Python 3.11+
- `asyncpg` for async Postgres (not `psycopg2` — asyncpg is faster and more idiomatic for async)
- `pydantic` v2 for schema validation (mirrors Zod in TS)
- No sync API — async-only, matches Python AI ecosystem conventions
- Framework adapters as optional extras: `pip install memexai[langchain]`, `pip install memexai[llamaindex]`

---

## Path Logic (must match TS exactly)

The Python `_paths.py` must implement the same rules as `packages/core/src/paths.ts`:
- `user/` → `users/{user_id}/`
- `shared/` → `shared/` (no translation)
- Block `users/`, `..`, `//`, absolute paths
- `assert_writable_virtual_path()` blocks writes to `shared/`

This is the critical correctness requirement — any divergence breaks cross-SDK compatibility.

---

## Migrations

Inline SQL strings in `_migrations.py` — identical to `packages/core/src/migrations.ts`. No `.sql` files. This ensures the package is self-contained for PyPI distribution (no data_files config, no path gymnastics).

---

## Hook System

```python
from memexai import create_memex
from memexai import create_pii_redact_hook

memex = create_memex(DATABASE_URL)
memex.add_hook("before_write", create_pii_redact_hook(policy="redact"))
```

Same hook contract as TS: `async def hook(content: str, ctx: ToolContext) -> str`. Hooks are run in `_tools.py` before the SQL upsert, same as TS.

---

## Verification

1. `pytest sdks/python/tests/` — unit tests with asyncpg mock
2. Integration test: `DATABASE_URL=postgresql://... python -m memexai.demo` — writes and reads without error
3. LangChain adapter: create a ReAct agent that writes to `user/profile.md` and reads it back
4. Run `pip install -e sdks/python/` + `from memexai import create_memex` in a fresh venv

---

## Build order dependency

Finalize TypeScript API shape (especially `smart_read` and `recall`) before implementing Python SDK so Python doesn't chase a moving target. Python SDK should include these from day 1.
