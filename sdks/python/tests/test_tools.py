import pytest

from memexai._tools import (
    append_lines_after_heading,
    execute_memory_list,
    execute_memory_patch,
    execute_memory_read,
    execute_memory_smart_read,
    execute_memory_write,
    replace_exact_text,
)
from memexai.errors import MemexError
from memexai.types import RequestContext
from conftest import FakeDb


CTX = RequestContext(userId="user_123", actor="pytest")


def test_patch_helpers_append_and_replace():
    appended = append_lines_after_heading("# Notes\n\n## Likes\n- Tea\n\n## Work\n", "## Likes", ["- Tea", "- Quiet"])
    assert appended["changed"] is True
    assert appended["content"].count("- Tea") == 1
    assert "- Quiet" in appended["content"]

    replaced = replace_exact_text("alpha\nbeta\n", "beta", ["gamma"])
    assert replaced == {"content": "alpha\ngamma\n", "changed": True}

    with pytest.raises(MemexError) as exc:
        replace_exact_text("same same", "same", "other")
    assert exc.value.code == "PATCH_AMBIGUOUS_MATCH"


@pytest.mark.asyncio
async def test_write_read_list_and_patch_memory_file():
    db = FakeDb({"shared/index.md": "# Shared"})

    write_result = await execute_memory_write(db, {
        "path": "user/profile.md",
        "content": "# Profile\n\n## Facts\n",
        "reason": "initial",
    }, CTX)
    assert write_result == {"path": "user/profile.md", "created": True, "updated": False}

    read_result = await execute_memory_read(db, {"path": "user/profile.md"}, CTX)
    assert read_result["content"].startswith("# Profile")

    patch_result = await execute_memory_patch(db, {
        "path": "user/profile.md",
        "operation": "append_lines",
        "after_heading": "## Facts",
        "lines": ["- Prefers quiet neighborhoods"],
        "reason": "preference",
    }, CTX)
    assert patch_result["changed"] is True
    assert "quiet neighborhoods" in db.files["users/user_123/profile.md"]["content_text"]

    list_result = await execute_memory_list(db, {}, CTX)
    assert [file["path"] for file in list_result["files"]] == ["shared/index.md", "user/profile.md"]
    assert len(db.revisions) == 2
    assert db.access_logs


@pytest.mark.asyncio
async def test_rejects_shared_write_and_missing_read():
    db = FakeDb()

    with pytest.raises(MemexError) as write_exc:
        await execute_memory_write(db, {"path": "shared/index.md", "content": "# Nope"}, CTX)
    assert write_exc.value.code == "READ_ONLY_MOUNT"

    with pytest.raises(MemexError) as read_exc:
        await execute_memory_read(db, {"path": "user/missing.md"}, CTX)
    assert read_exc.value.code == "FILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_smart_read_returns_memory_block_and_budget_metadata():
    db = FakeDb({
        "users/user_123/profile.md": "# Profile\n- Quiet",
        "shared/index.md": "# Shared",
    })

    result = await execute_memory_smart_read(db, {"maxChars": 200}, CTX)
    assert result["content"].startswith("<memexai_memory>")
    assert "user/profile.md" in result["filesIncluded"]
    assert result["truncated"] is False


@pytest.mark.asyncio
async def test_smart_read_query_expands_one_hop_links():
    db = FakeDb({
        "users/user_123/profile.md": "# Profile\n[[user/preferences.md]]\n[[shared/index.md]]",
        "users/user_123/preferences.md": "# Preferences\n- Quiet",
        "shared/index.md": "# Shared",
    })
    db.files["users/user_123/profile.md"]["rank"] = 0.8

    result = await execute_memory_smart_read(db, {"query": "quiet", "maxChars": 10000}, CTX)

    assert result["filesIncluded"] == ["user/profile.md", "user/preferences.md", "shared/index.md"]
    assert result["filesIncludedMeta"] == [
        {"path": "user/profile.md", "reason": "query_match", "depth": 0},
        {"path": "user/preferences.md", "reason": "linked", "depth": 1, "linkedFrom": "user/profile.md"},
        {"path": "shared/index.md", "reason": "linked", "depth": 1, "linkedFrom": "user/profile.md"},
    ]


@pytest.mark.asyncio
async def test_smart_read_does_not_expand_without_query_by_default():
    db = FakeDb({
        "users/user_123/profile.md": "# Profile\n[[user/preferences.md]]",
    })

    result = await execute_memory_smart_read(db, {"maxChars": 10000}, CTX)

    assert result["filesIncluded"] == ["user/profile.md"]
    assert not any("physical_path = ANY($1)" in call[1] for call in db.calls if call[0] == "query")


@pytest.mark.asyncio
async def test_smart_read_respects_depth_zero_and_circular_links():
    disabled_db = FakeDb({
        "users/user_123/a.md": "# A\n[[user/b.md]]",
        "users/user_123/b.md": "# B",
    })
    disabled_db.files["users/user_123/a.md"]["rank"] = 1

    disabled = await execute_memory_smart_read(disabled_db, {
        "query": "alpha",
        "relatedDepth": 0,
        "maxChars": 10000,
    }, CTX)
    assert disabled["filesIncluded"] == ["user/a.md"]

    circular_db = FakeDb({
        "users/user_123/a.md": "# A\n[[user/b.md]]",
        "users/user_123/b.md": "# B\n[[user/a.md]]\n[[user/c.md]]",
        "users/user_123/c.md": "# C",
    })
    circular_db.files["users/user_123/a.md"]["rank"] = 1

    circular = await execute_memory_smart_read(circular_db, {
        "query": "alpha",
        "relatedDepth": 2,
        "maxChars": 10000,
    }, CTX)
    assert circular["filesIncluded"] == ["user/a.md", "user/b.md", "user/c.md"]


@pytest.mark.asyncio
async def test_rejects_numeric_arguments_outside_core_bounds():
    db = FakeDb()

    with pytest.raises(MemexError) as exc:
        await execute_memory_smart_read(db, {"maxChars": 0}, CTX)
    assert exc.value.code == "INVALID_ARGS"

    with pytest.raises(MemexError) as depth_exc:
        await execute_memory_smart_read(db, {"relatedDepth": 3}, CTX)
    assert depth_exc.value.code == "INVALID_ARGS"
