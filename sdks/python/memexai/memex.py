import json
from typing import Optional, Union, Dict, Any, List
from ._db import DbPool, create_pool
from ._migrations import run_migrations
from ._hooks import HookRegistry
from ._tools import execute_tool
from .types import RequestContext
from .tool_definitions import tool_definitions

async def read_optional_file(db: DbPool, physical_path: str) -> Optional[str]:
    try:
        rows = await db.query("SELECT content_text FROM mx_file WHERE physical_path = $1", physical_path)
        return rows[0]["content_text"] if rows else None
    except Exception:
        return None

async def build_prompt_block(db: DbPool, ctx: RequestContext) -> str:
    from .tool_definitions import agentic_tool_definitions, raw_tool_definitions

    shared_index = await read_optional_file(db, "shared/index.md")
    shared_claude = await read_optional_file(db, "shared/claude.md")
    user_index = await read_optional_file(db, f"users/{ctx.user_id}/index.md")

    docs = []
    if shared_index:
        docs.append(f'<shared_index path="shared/index.md">\n{shared_index}\n</shared_index>')
    if shared_claude:
        docs.append(f'<shared_instructions path="shared/claude.md">\n{shared_claude}\n</shared_instructions>')
    if user_index:
        docs.append(f'<user_index path="user/index.md">\n{user_index}\n</user_index>')

    recommended = json.dumps(agentic_tool_definitions, indent=2)
    raw = json.dumps(raw_tool_definitions, indent=2)

    parts = [
        "<memexai_memory>",
        "You have access to MemexAI memory.",
        "Prefer the agentic memory tools: memory_memorize to remember durable facts, and memory_search to retrieve memory.",
        "MemexAI handles file bookkeeping for agentic tools. Use virtual paths only if raw tools are explicitly provided.",
        "Writable user memory lives under user/**. Shared memory lives under shared/** and is read-only.",
        "Never use physical paths such as users/{userId}/... .",
        "",
        "<recommended_tools>",
        recommended,
        "</recommended_tools>",
        "<raw_tools>",
        raw,
        "</raw_tools>",
    ]
    if docs:
        parts.append("\n" + "\n".join(docs))
    parts.append("</memexai_memory>")

    return "\n".join(parts)

class Memex:
    def __init__(self, db: DbPool, model: Optional[Any] = None):
        self.db = db
        self.model = model
        self.hooks = HookRegistry()

    async def migrate(self) -> None:
        await run_migrations(self.db)

    def get_tools(self) -> List[Dict[str, Any]]:
        return tool_definitions

    async def execute_tool(self, tool_name: str, args: Dict[str, Any], ctx: RequestContext) -> Dict[str, Any]:
        # Run pre-hooks
        ctx_dict = ctx.model_dump()
        args = await self.hooks.run_pre_hooks(tool_name, args, ctx_dict)
        # Execute core tool
        result = await execute_tool(self.db, tool_name, args, ctx, self.model)
        # Run post-hooks
        result = await self.hooks.run_post_hooks(tool_name, result, ctx_dict)
        return result

    def get_model(self) -> Optional[Any]:
        return self.model

    async def get_prompt_block(self, ctx: RequestContext) -> str:
        return await build_prompt_block(self.db, ctx)

    def for_user(self, ctx_or_user_id: Union[RequestContext, str], actor: Optional[str] = None) -> 'MemexUser':
        if isinstance(ctx_or_user_id, str):
            ctx = RequestContext(userId=ctx_or_user_id, actor=actor)
        else:
            ctx = ctx_or_user_id
        return MemexUser(self, ctx)

    async def close(self) -> None:
        await self.db.close()

class MemexUser:
    def __init__(self, memex: Memex, ctx: RequestContext):
        self.memex = memex
        self.ctx = ctx

    async def get_prompt_block(self) -> str:
        return await self.memex.get_prompt_block(self.ctx)

    async def list_files(self, prefix: Optional[str] = None) -> Dict[str, Any]:
        args = {}
        if prefix:
            args["prefix"] = prefix
        return await self.memex.execute_tool("memory_list", args, self.ctx)

    async def read_file(self, path: str) -> Dict[str, Any]:
        return await self.memex.execute_tool("memory_read", {"path": path}, self.ctx)

    async def write_file(self, path: str, content: str, reason: Optional[str] = None) -> Dict[str, Any]:
        args = {"path": path, "content": content}
        if reason:
            args["reason"] = reason
        return await self.memex.execute_tool("memory_write", args, self.ctx)

    async def patch_file(self, path: str, operation: str, **kwargs) -> Dict[str, Any]:
        args = {"path": path, "operation": operation, **kwargs}
        return await self.memex.execute_tool("memory_patch", args, self.ctx)

    async def search(self, query: str, **kwargs) -> Dict[str, Any]:
        args = {"query": query, **kwargs}
        return await self.memex.execute_tool("memory_search", args, self.ctx)

    async def memorize(self, text: str, **kwargs) -> Dict[str, Any]:
        args = {"text": text, **kwargs}
        return await self.memex.execute_tool("memory_memorize", args, self.ctx)

    async def execute_tool(self, tool_name: str, args: Dict[str, Any], tool_call_id: Optional[str] = None) -> Dict[str, Any]:
        ctx = self.ctx
        if tool_call_id:
            ctx = RequestContext(userId=self.ctx.user_id, actor=self.ctx.actor, toolCallId=tool_call_id)
        return await self.memex.execute_tool(tool_name, args, ctx)

async def create_memex(input_val: Union[str, Dict[str, Any]]) -> Memex:
    if isinstance(input_val, str):
        database_url = input_val
        model = None
    else:
        database_url = input_val["databaseUrl"]
        model = input_val.get("model")
    db = await create_pool(database_url)
    return Memex(db, model)
