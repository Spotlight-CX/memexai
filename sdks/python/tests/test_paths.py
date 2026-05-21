import pytest

from memexai._paths import (
    assert_writable_virtual_path,
    physical_to_virtual,
    prefix_to_physical,
    validate_virtual_path,
    virtual_to_physical,
)
from memexai.errors import MemexError
from memexai.types import RequestContext


CTX = RequestContext(userId="user_123", actor="pytest")


def test_virtual_physical_path_mapping():
    assert virtual_to_physical("user/profile.md", CTX) == "users/user_123/profile.md"
    assert virtual_to_physical("shared/index.md", CTX) == "shared/index.md"
    assert physical_to_virtual("users/user_123/profile.md", CTX) == "user/profile.md"
    assert physical_to_virtual("users/other/profile.md", CTX) is None
    assert prefix_to_physical("user/", CTX) == "users/user_123"


@pytest.mark.parametrize("path", ["/user/a.md", "user//a.md", "user/../a.md", "users/user_123/a.md", "other/a.md"])
def test_rejects_unsafe_or_unknown_paths(path):
    with pytest.raises(MemexError):
        validate_virtual_path(path)
        virtual_to_physical(path, CTX)


def test_allows_writes_only_under_user_mount():
    assert_writable_virtual_path("user/notes.md")
    with pytest.raises(MemexError) as exc:
        assert_writable_virtual_path("shared/index.md")
    assert exc.value.code == "READ_ONLY_MOUNT"
