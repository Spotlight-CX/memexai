from typing import Any, List

from ._shared import make_coroutine, tool_description, tool_names_for_mode


def get_crewai_tools(user: Any, mode: str = "subagent") -> List[Any]:
    try:
        from crewai.tools import tool
    except ImportError:
        try:
            from crewai_tools import tool
        except ImportError:
            raise ImportError("crewai or crewai_tools is not installed. Please install it to use this adapter.")

    tools = []
    for name in tool_names_for_mode(mode):
        tools.append(_make_tool(tool, name, make_coroutine(user, name)))

    return tools


def _make_tool(tool_decorator: Any, name: str, coroutine: Any) -> Any:
    @tool_decorator(name)
    async def wrapped(**kwargs) -> str:
        return await coroutine(**kwargs)

    wrapped.__doc__ = tool_description(name)
    return wrapped
