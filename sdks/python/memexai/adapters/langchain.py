from typing import Any, List

from ._shared import make_coroutine, tool_description, tool_names_for_mode


def get_langchain_tools(user: Any, mode: str = "subagent") -> List[Any]:
    try:
        from langchain.tools import StructuredTool
    except ImportError:
        raise ImportError("langchain is not installed. Please install it to use this adapter.")

    return [
        StructuredTool.from_function(
            name=name,
            description=tool_description(name),
            func=None,
            coroutine=make_coroutine(user, name),
        )
        for name in tool_names_for_mode(mode)
    ]
