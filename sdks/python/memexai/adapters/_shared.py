import json
from typing import Any, Callable, Dict, List


SUBAGENT_TOOL_NAMES = ["memory_remember", "memory_context"]
RAW_TOOL_NAMES = ["memory_list", "memory_read", "memory_write", "memory_patch", "memory_find"]
ALL_TOOL_NAMES = SUBAGENT_TOOL_NAMES + RAW_TOOL_NAMES


def tool_names_for_mode(mode: str = "subagent") -> List[str]:
    if mode in ("subagent", "agentic"):
        return list(SUBAGENT_TOOL_NAMES)
    if mode == "raw":
        return list(RAW_TOOL_NAMES)
    if mode == "all":
        return list(ALL_TOOL_NAMES)
    raise ValueError("mode must be one of: subagent, raw, all")


def tool_description(name: str) -> str:
    return {
        "memory_remember": "Feed raw text to MemexAI and let it decide which durable facts to store.",
        "memory_context": "Retrieve a formatted memory context block for a query or broad recall goal.",
        "memory_list": "List memory files visible to the current user.",
        "memory_read": "Read a single memory file by virtual path.",
        "memory_write": "Create or fully overwrite a writable memory file.",
        "memory_patch": "Apply a targeted update to a writable memory file.",
        "memory_find": "Search memory for ranked file snippets by keyword or semantic query.",
    }[name]


def make_coroutine(user: Any, name: str) -> Callable[..., Any]:
    async def memory_remember(text: str, **kwargs) -> str:
        return dumps(await user.remember(text, **kwargs))

    async def memory_context(maxChars: int = 24000, query: str = None, **kwargs) -> str:
        args: Dict[str, Any] = {"maxChars": maxChars, **kwargs}
        if query is not None:
            args["query"] = query
        return dumps(await user.retrieve_context(args))

    async def memory_list(prefix: str = None) -> str:
        return dumps(await user.list_files(prefix=prefix))

    async def memory_read(path: str) -> str:
        return dumps(await user.read_file(path=path))

    async def memory_write(path: str, content: str, reason: str = None) -> str:
        return dumps(await user.write_file(path=path, content=content, reason=reason))

    async def memory_patch(path: str, operation: str, **kwargs) -> str:
        return dumps(await user.patch_file(path=path, operation=operation, **kwargs))

    async def memory_find(query: str, **kwargs) -> str:
        return dumps(await user.find(query=query, **kwargs))

    return {
        "memory_remember": memory_remember,
        "memory_context": memory_context,
        "memory_list": memory_list,
        "memory_read": memory_read,
        "memory_write": memory_write,
        "memory_patch": memory_patch,
        "memory_find": memory_find,
    }[name]


def dumps(value: Any) -> str:
    return json.dumps(value, default=str)
