# MemexAI Python SDK

A Python client for MemexAI. The recommended path is to connect to the containerized MemexAI service; direct Postgres mode is available for advanced in-process deployments.

## Install

From this repository:

```bash
python3 -m pip install -e ".[test]"
```

For optional framework adapters:

```bash
python3 -m pip install -e ".[langchain]"
python3 -m pip install -e ".[llamaindex]"
python3 -m pip install -e ".[crewai]"
```

Run those commands from `sdks/python`. From the repository root, keep the `sdks/python[...]` path form.

## Service Usage

Start the MemexAI service first:

```bash
docker compose up -d
```

Then connect from Python:

```python
from memexai import MemexAI

memex = MemexAI(
    url="http://localhost:8080",
    api_key="dev-agent-key",
)

memory = memex.for_user("user_123", actor="assistant")
await memory.write_file(
    "user/profile.md",
    "# Profile\n\n- Prefers quiet neighborhoods.",
    reason="captured preference",
)

result = await memory.read_file("user/profile.md")
print(result["content"])

await memex.close()
```

The service runs migrations and holds database credentials. Your Python app only needs the service URL and API key.

## Advanced Direct Postgres Usage

Use direct Postgres mode only when your Python application should own database credentials.

```python
from memexai import create_memex

memex = await create_memex({
    "databaseUrl": "postgresql://memexai:memexai@localhost:5433/memexai",
})

await memex.migrate()

memory = memex.for_user("user_123", actor="assistant")
result = await memory.search("quiet neighborhoods")

await memex.close()
```

## Tools

User-scoped helpers mirror the TypeScript core package:

```python
await memory.list_files(prefix="user/")
await memory.read_file("user/profile.md")
await memory.write_file("user/profile.md", "# Profile", reason="initial write")
await memory.patch_file(
    "user/profile.md",
    "append_lines",
    after_heading="# Profile",
    lines=["- Likes good tests"],
    reason="new preference",
)
await memory.search("quiet neighborhoods")
await memory.memorize("Remember that the user prefers quiet neighborhoods.")
```

Raw MCP-style execution is also available:

```python
await memory.execute_tool("memory_write", {
    "path": "user/profile.md",
    "content": "# Profile",
}, tool_call_id="call_123")
```

## Hooks

Hooks run before and after tool execution:

```python
from memexai import pii_pre_hook

memex.hooks.register_pre_hook(pii_pre_hook)
```

`pii_pre_hook` redacts common email, phone, and SSN-like values before memory writes, patches, or memorize calls.

## Framework Adapters

Optional adapters return each framework's native tool objects without importing those frameworks at package import time:

```python
from memexai.adapters.langchain import get_langchain_tools
from memexai.adapters.llamaindex import get_llamaindex_tools
from memexai.adapters.crewai import get_crewai_tools

langchain_tools = get_langchain_tools(memory)
llamaindex_tools = get_llamaindex_tools(memory)
crewai_tools = get_crewai_tools(memory)
```

Install the matching optional dependency before importing an adapter:

```bash
python3 -m pip install -e ".[langchain]"
python3 -m pip install -e ".[llamaindex]"
python3 -m pip install -e ".[crewai]"
```

## Tests

```bash
cd sdks/python
python3 -m pip install -e ".[test]"
python3 -m pytest
```

With `uv`:

```bash
cd sdks/python
uv run --extra test pytest
```

Postgres integration tests are skipped unless `MEMEXAI_TEST_DATABASE_URL` is set:

```bash
MEMEXAI_TEST_DATABASE_URL=postgresql://... python3 -m pytest
```
