from typing import Any, List

from ._shared import make_coroutine, tool_description, tool_names_for_mode


def get_llamaindex_tools(user: Any, mode: str = "subagent") -> List[Any]:
    try:
        from llama_index.core.tools import FunctionTool
    except ImportError:
        raise ImportError("llama-index-core is not installed. Please install it to use this adapter.")

    return [
        FunctionTool.from_defaults(
            async_fn=make_coroutine(user, name),
            name=name,
            description=tool_description(name),
        )
        for name in tool_names_for_mode(mode)
    ]
