import json

import httpx
import pytest

from memexai import MemexAI, MemexError


def mock_client(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_service_client_requires_url_and_api_key():
    with pytest.raises(MemexError) as url_exc:
        MemexAI(url="", api_key="agent-key")
    assert url_exc.value.code == "INVALID_OPTIONS"

    with pytest.raises(MemexError) as key_exc:
        MemexAI(url="http://localhost:8080", api_key="")
    assert key_exc.value.code == "INVALID_OPTIONS"


@pytest.mark.asyncio
async def test_service_client_sends_bearer_auth_and_tool_payload():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"path": "user/profile.md", "created": True, "updated": False})

    client = MemexAI(
        url="http://memex.test/",
        api_key="agent-key",
        client=mock_client(handler),
    )
    memory = client.for_user("user_123", actor="pytest")

    result = await memory.write_file(
        "user/profile.md",
        "# Profile",
        reason="test",
        tool_call_id="call_1",
    )

    assert result["created"] is True
    assert seen["url"] == "http://memex.test/v1/tools/memory_write/execute"
    assert seen["auth"] == "Bearer agent-key"
    assert seen["body"] == {
        "context": {
            "userId": "user_123",
            "actor": "pytest",
            "toolCallId": "call_1",
        },
        "arguments": {
            "path": "user/profile.md",
            "content": "# Profile",
            "reason": "test",
        },
    }


@pytest.mark.asyncio
async def test_for_user_requires_user_id():
    client = MemexAI(
        url="http://memex.test",
        api_key="agent-key",
        client=mock_client(lambda request: httpx.Response(200, json={})),
    )

    with pytest.raises(MemexError) as exc:
        client.for_user("")
    assert exc.value.code == "USER_ID_REQUIRED"


@pytest.mark.asyncio
async def test_prompt_block_uses_query_context():
    seen_url = None

    def handler(request):
        nonlocal seen_url
        seen_url = str(request.url)
        return httpx.Response(200, json={"promptBlock": "<memexai_memory>"})

    client = MemexAI(
        url="http://memex.test",
        api_key="agent-key",
        client=mock_client(handler),
    )

    prompt = await client.for_user("user_123", actor="assistant").get_prompt_block()

    assert prompt == "<memexai_memory>"
    assert seen_url == "http://memex.test/v1/prompt-block?userId=user_123&actor=assistant"


@pytest.mark.asyncio
async def test_service_error_json_becomes_memex_error():
    def handler(request):
        return httpx.Response(404, json={
            "error": {
                "code": "FILE_NOT_FOUND",
                "message": "File not found",
                "issues": [{"path": "user/missing.md"}],
            }
        })

    client = MemexAI(
        url="http://memex.test",
        api_key="agent-key",
        client=mock_client(handler),
    )

    with pytest.raises(MemexError) as exc:
        await client.for_user("user_123").read_file("user/missing.md")

    assert exc.value.code == "FILE_NOT_FOUND"
    assert exc.value.message == "File not found"
    assert exc.value.status_code == 404
    assert exc.value.details == [{"path": "user/missing.md"}]


@pytest.mark.asyncio
async def test_invalid_service_json_becomes_stable_error():
    client = MemexAI(
        url="http://memex.test",
        api_key="agent-key",
        client=mock_client(lambda request: httpx.Response(200, text="not-json")),
    )

    with pytest.raises(MemexError) as exc:
        await client.for_user("user_123").list_files()
    assert exc.value.code == "INVALID_JSON_RESPONSE"


@pytest.mark.asyncio
async def test_memory_helpers_map_to_expected_tools():
    calls = []

    def handler(request):
        body = json.loads(request.content)
        calls.append((str(request.url), body))
        return httpx.Response(200, json={"ok": True})

    client = MemexAI(
        url="http://memex.test",
        api_key="agent-key",
        client=mock_client(handler),
    )
    memory = client.for_user({"user_id": "user_123", "actor": "pytest"})

    assert await memory.list_files(prefix="user/") == {"ok": True}
    assert await memory.search("quiet", limit=2) == {"ok": True}
    assert await memory.memorize({"text": "remember this", "dryRun": True}, tool_call_id="call_2") == {"ok": True}

    assert calls[0][0].endswith("/v1/tools/memory_list/execute")
    assert calls[0][1]["arguments"] == {"prefix": "user/"}
    assert calls[1][0].endswith("/v1/tools/memory_search/execute")
    assert calls[1][1]["arguments"] == {"query": "quiet", "limit": 2}
    assert calls[2][0].endswith("/v1/tools/memory_memorize/execute")
    assert calls[2][1] == {
        "context": {
            "userId": "user_123",
            "actor": "pytest",
            "toolCallId": "call_2",
        },
        "arguments": {
            "text": "remember this",
            "dryRun": True,
        },
    }
