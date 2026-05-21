# MemexAI Python SDK

A direct-Postgres Python client for MemexAI, mirroring `@memexai/core` precisely.

## Install

From this repository:

```bash
python3 -m pip install -e "sdks/python[test]"
```

For optional framework adapters:

```bash
python3 -m pip install -e "sdks/python[langchain]"
python3 -m pip install -e "sdks/python[llamaindex]"
python3 -m pip install -e "sdks/python[crewai]"
```

## Direct Postgres Usage

```python
from memexai import create_memex

memex = await create_memex({
    "databaseUrl": "postgresql://memexai:memexai@localhost:5433/memexai",
})

await memex.migrate()

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

The Python SDK is direct-Postgres only. Use the TypeScript `@memexai/sdk` package when you want a REST client for the hosted service.

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

## Tests

```bash
cd sdks/python
python3 -m pytest
```

Postgres integration tests are skipped unless `MEMEXAI_TEST_DATABASE_URL` is set:

```bash
MEMEXAI_TEST_DATABASE_URL=postgresql://... python3 -m pytest
```
