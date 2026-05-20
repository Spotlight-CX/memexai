from typing import Optional
from .errors import MemexError
from .types import RequestContext

def validate_virtual_path(path: str) -> None:
    if not path or not isinstance(path, str):
        raise MemexError("INVALID_PATH", "path is required")

    if path.startswith("/") or "\\" in path or "//" in path:
        raise MemexError("INVALID_PATH", "Path must be a relative slash-delimited path")

    segments = path.split("/")
    if any(segment in ("", ".", "..") for segment in segments):
        raise MemexError("INVALID_PATH", "Path cannot contain empty, dot, or dot-dot segments")

    if segments[0] == "users":
        raise MemexError("PHYSICAL_PATH_FORBIDDEN", "Agents cannot use physical users/{userId} paths")

def virtual_to_physical(path: str, ctx: RequestContext) -> str:
    validate_virtual_path(path)

    if path == "user" or path.startswith("user/"):
        if not ctx.user_id:
            raise MemexError("USER_ID_REQUIRED", "userId is required for user/** memory paths")
        if path == "user":
            return f"users/{ctx.user_id}"
        return f"users/{ctx.user_id}/{path[len('user/'):]}"

    if path == "shared" or path.startswith("shared/"):
        return path

    raise MemexError("UNKNOWN_MOUNT", "Path must start with user/ or shared/")

def physical_to_virtual(physical_path: str, ctx: RequestContext) -> Optional[str]:
    user_prefix = f"users/{ctx.user_id}/"
    if physical_path.startswith(user_prefix):
        return f"user/{physical_path[len(user_prefix):]}"

    if physical_path == f"users/{ctx.user_id}":
        return "user"

    if physical_path == "shared" or physical_path.startswith("shared/"):
        return physical_path

    return None

def assert_writable_virtual_path(path: str) -> None:
    validate_virtual_path(path)
    if not (path == "user" or path.startswith("user/")):
        raise MemexError("READ_ONLY_MOUNT", "Agents cannot write to shared/**")

def prefix_to_physical(prefix: Optional[str], ctx: RequestContext) -> Optional[str]:
    if not prefix:
        return None
    normalized = prefix[:-1] if prefix.endswith("/") else prefix
    return virtual_to_physical(normalized, ctx)
