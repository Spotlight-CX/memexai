import pytest

import memexai.memex as memex_module
from conftest import FakeDb
from memexai import Memex, MemexError, pii_pre_hook, redact_pii
from memexai.types import RequestContext


def test_error_codes_and_pii_redaction():
    error = MemexError("NOPE", "Something happened")
    assert error.code == "NOPE"
    assert str(error) == "NOPE: Something happened"
    assert redact_pii("mail me at user@example.com") == "mail me at [REDACTED_EMAIL]"


@pytest.mark.asyncio
async def test_memex_user_helpers_delegate_and_hooks_run(monkeypatch):
    calls = []

    async def fake_execute_tool(db, tool_name, args, ctx, model):
        calls.append((tool_name, args, ctx, model))
        return {"tool": tool_name, "args": args, "actor": ctx.actor}

    monkeypatch.setattr(memex_module, "execute_tool", fake_execute_tool)

    memex = Memex(FakeDb(), model="model")

    async def add_pre_marker(tool_name, args, ctx):
        next_args = dict(args)
        next_args["pre"] = tool_name
        next_args["ctx_user"] = ctx["user_id"]
        return next_args

    async def add_post_marker(tool_name, result, ctx):
        next_result = dict(result)
        next_result["post"] = tool_name
        next_result["ctx_user"] = ctx["user_id"]
        return next_result

    memex.hooks.register_pre_hook(add_pre_marker)
    memex.hooks.register_post_hook(add_post_marker)

    user = memex.for_user("user_123", actor="pytest")
    result = await user.write_file("user/profile.md", "hello", reason="test")

    assert result["tool"] == "memory_write"
    assert result["args"]["pre"] == "memory_write"
    assert result["post"] == "memory_write"
    assert result["ctx_user"] == "user_123"
    assert calls[0][2].user_id == "user_123"
    assert calls[0][3] == "model"


@pytest.mark.asyncio
async def test_memex_execute_tool_preserves_tool_call_id(monkeypatch):
    seen_contexts = []

    async def fake_execute_tool(db, tool_name, args, ctx, model):
        seen_contexts.append(ctx)
        return {"ok": True}

    monkeypatch.setattr(memex_module, "execute_tool", fake_execute_tool)

    user = Memex(FakeDb()).for_user(RequestContext(userId="user_123", actor="pytest"))
    assert await user.execute_tool("memory_read", {"path": "user/profile.md"}, tool_call_id="call_1") == {"ok": True}
    assert seen_contexts[0].tool_call_id == "call_1"


@pytest.mark.asyncio
async def test_pii_pre_hook_filters_memory_arguments():
    result = await pii_pre_hook("memory_write", {
        "path": "user/profile.md",
        "content": "Email user@example.com",
    }, {"user_id": "user_123"})
    assert result["content"] == "Email [REDACTED_EMAIL]"
