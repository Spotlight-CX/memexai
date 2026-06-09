import json
import sys
import types

import pytest

from memexai.adapters.crewai import get_crewai_tools
from memexai.adapters.langchain import get_langchain_tools
from memexai.adapters.llamaindex import get_llamaindex_tools


class FakeUser:
    def __init__(self):
        self.ctx = {"userId": "user_123"}
        self.memex = self

    async def list_files(self, prefix=None):
        return {"files": [{"path": prefix or "user/profile.md"}]}

    async def read_file(self, path):
        return {"path": path, "content": "# Profile"}

    async def write_file(self, path, content, reason=None):
        return {"path": path, "created": True, "updated": False}

    async def patch_file(self, path, operation, **kwargs):
        return {"path": path, "operation": operation, "changed": True, "noOp": False}

    async def find(self, query, **kwargs):
        return {"query": query, "results": [], "truncated": False}

    async def remember(self, text, **kwargs):
        return {"text": text, "dryRun": False, "writes": []}

    async def retrieve_context(self, query=None, **kwargs):
        return {"context": "<memexai_memory>", "filesRead": []}

    async def execute_tool(self, tool_name, args, ctx):
        return {"context": "<memexai_memory>", "filesRead": []}


def test_langchain_adapter_builds_structured_tools(monkeypatch):
    tools_module = types.ModuleType("langchain.tools")

    class StructuredTool:
        @staticmethod
        def from_function(**kwargs):
            return kwargs

    tools_module.StructuredTool = StructuredTool
    monkeypatch.setitem(sys.modules, "langchain", types.ModuleType("langchain"))
    monkeypatch.setitem(sys.modules, "langchain.tools", tools_module)

    tools = get_langchain_tools(FakeUser())
    assert [tool["name"] for tool in tools] == [
        "memory_remember",
        "memory_context",
    ]

    raw_tools = get_langchain_tools(FakeUser(), mode="raw")
    assert [tool["name"] for tool in raw_tools] == [
        "memory_list",
        "memory_read",
        "memory_write",
        "memory_patch",
        "memory_find",
    ]


def test_llamaindex_adapter_builds_function_tools(monkeypatch):
    tools_module = types.ModuleType("llama_index.core.tools")

    class FunctionTool:
        @staticmethod
        def from_defaults(**kwargs):
            return kwargs

    tools_module.FunctionTool = FunctionTool
    monkeypatch.setitem(sys.modules, "llama_index", types.ModuleType("llama_index"))
    monkeypatch.setitem(sys.modules, "llama_index.core", types.ModuleType("llama_index.core"))
    monkeypatch.setitem(sys.modules, "llama_index.core.tools", tools_module)

    tools = get_llamaindex_tools(FakeUser())
    assert [tool["name"] for tool in tools] == ["memory_remember", "memory_context"]

    all_tools = get_llamaindex_tools(FakeUser(), mode="all")
    assert [tool["name"] for tool in all_tools] == [
        "memory_remember",
        "memory_context",
        "memory_list",
        "memory_read",
        "memory_write",
        "memory_patch",
        "memory_find",
    ]


def test_crewai_adapter_builds_decorated_tools(monkeypatch):
    tools_module = types.ModuleType("crewai.tools")

    def tool(name):
        def decorator(fn):
            fn.tool_name = name
            return fn
        return decorator

    tools_module.tool = tool
    monkeypatch.setitem(sys.modules, "crewai", types.ModuleType("crewai"))
    monkeypatch.setitem(sys.modules, "crewai.tools", tools_module)

    tools = get_crewai_tools(FakeUser())
    assert [tool.tool_name for tool in tools] == [
        "memory_remember",
        "memory_context",
    ]


@pytest.mark.asyncio
async def test_adapter_tool_coroutines_return_json(monkeypatch):
    tools_module = types.ModuleType("langchain.tools")

    class StructuredTool:
        @staticmethod
        def from_function(**kwargs):
            return kwargs

    tools_module.StructuredTool = StructuredTool
    monkeypatch.setitem(sys.modules, "langchain", types.ModuleType("langchain"))
    monkeypatch.setitem(sys.modules, "langchain.tools", tools_module)

    list_tool = get_langchain_tools(FakeUser(), mode="raw")[0]
    result = await list_tool["coroutine"](prefix="user/")
    assert json.loads(result)["files"][0]["path"] == "user/"

    remember_tool = get_langchain_tools(FakeUser())[0]
    remember_result = await remember_tool["coroutine"](text="remember this")
    assert json.loads(remember_result)["writes"] == []
