from typing import List, Any
from ..memex import MemexUser

def get_llamaindex_tools(user: MemexUser) -> List[Any]:
    try:
        from llama_index.core.tools import FunctionTool
    except ImportError:
        raise ImportError("llama-index-core is not installed. Please install it to use this adapter.")

    tools = []

    # memory_list
    async def list_files(prefix: str = None) -> str:
        res = await user.list_files(prefix=prefix)
        import json
        return json.dumps(res, default=str)

    tools.append(FunctionTool.from_defaults(
        async_fn=list_files,
        name="memory_list",
        description="List memory files visible to the current user.",
    ))

    # memory_read
    async def read_file(path: str) -> str:
        res = await user.read_file(path=path)
        import json
        return json.dumps(res, default=str)

    tools.append(FunctionTool.from_defaults(
        async_fn=read_file,
        name="memory_read",
        description="Read a single memory file by its virtual path.",
    ))

    # memory_write
    async def write_file(path: str, content: str, reason: str = None) -> str:
        res = await user.write_file(path=path, content=content, reason=reason)
        import json
        return json.dumps(res, default=str)

    tools.append(FunctionTool.from_defaults(
        async_fn=write_file,
        name="memory_write",
        description="Create or fully overwrite a user/** memory file.",
    ))

    # memory_patch
    async def patch_file(path: str, operation: str, **kwargs) -> str:
        res = await user.patch_file(path=path, operation=operation, **kwargs)
        import json
        return json.dumps(res, default=str)

    tools.append(FunctionTool.from_defaults(
        async_fn=patch_file,
        name="memory_patch",
        description="Apply targeted updates to a user/** memory file.",
    ))

    # memory_smart_read
    async def smart_read(maxChars: int = 24000, query: str = None) -> str:
        res = await user.memex.execute_tool("memory_smart_read", {"maxChars": maxChars, "query": query}, user.ctx)
        import json
        return json.dumps(res, default=str)

    tools.append(FunctionTool.from_defaults(
        async_fn=smart_read,
        name="memory_smart_read",
        description="Read all memory files formatted into a single markdown block.",
    ))

    # memory_search
    async def search(query: str, **kwargs) -> str:
        res = await user.search(query=query, **kwargs)
        import json
        return json.dumps(res, default=str)

    tools.append(FunctionTool.from_defaults(
        async_fn=search,
        name="memory_search",
        description="Search memory for a question using BM25 full-text search.",
    ))

    # memory_memorize
    async def memorize(text: str, **kwargs) -> str:
        res = await user.memorize(text=text, **kwargs)
        import json
        return json.dumps(res, default=str)

    tools.append(FunctionTool.from_defaults(
        async_fn=memorize,
        name="memory_memorize",
        description="Feed raw text and let MemexAI autonomously decide what to remember.",
    ))

    return tools
