from typing import List, Any
from ..memex import MemexUser

def get_crewai_tools(user: MemexUser) -> List[Any]:
    try:
        from crewai.tools import tool
    except ImportError:
        try:
            from crewai_tools import tool
        except ImportError:
            raise ImportError("crewai or crewai_tools is not installed. Please install it to use this adapter.")

    tools = []

    @tool("memory_list")
    async def list_files(prefix: str = None) -> str:
        """List memory files visible to the current user."""
        res = await user.list_files(prefix=prefix)
        import json
        return json.dumps(res, default=str)

    tools.append(list_files)

    @tool("memory_read")
    async def read_file(path: str) -> str:
        """Read a single memory file by its virtual path."""
        res = await user.read_file(path=path)
        import json
        return json.dumps(res, default=str)

    tools.append(read_file)

    @tool("memory_write")
    async def write_file(path: str, content: str, reason: str = None) -> str:
        """Create or fully overwrite a user/** memory file."""
        res = await user.write_file(path=path, content=content, reason=reason)
        import json
        return json.dumps(res, default=str)

    tools.append(write_file)

    @tool("memory_patch")
    async def patch_file(path: str, operation: str, **kwargs) -> str:
        """Apply targeted updates to a user/** memory file."""
        res = await user.patch_file(path=path, operation=operation, **kwargs)
        import json
        return json.dumps(res, default=str)

    tools.append(patch_file)

    @tool("memory_smart_read")
    async def smart_read(maxChars: int = 24000, query: str = None) -> str:
        """Read all memory files formatted into a single markdown block."""
        res = await user.memex.execute_tool("memory_smart_read", {"maxChars": maxChars, "query": query}, user.ctx)
        import json
        return json.dumps(res, default=str)

    tools.append(smart_read)

    @tool("memory_search")
    async def search(query: str, **kwargs) -> str:
        """Search memory for a question using BM25 full-text search."""
        res = await user.search(query=query, **kwargs)
        import json
        return json.dumps(res, default=str)

    tools.append(search)

    @tool("memory_memorize")
    async def memorize(text: str, **kwargs) -> str:
        """Feed raw text and let MemexAI autonomously decide what to remember."""
        res = await user.memorize(text=text, **kwargs)
        import json
        return json.dumps(res, default=str)

    tools.append(memorize)

    return tools
