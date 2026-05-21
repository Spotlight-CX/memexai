import json
from typing import Any, Dict, Optional, Union
from urllib.parse import quote, urlencode

import httpx

from .errors import MemexError
from .types import MemoryContext, RequestContext


class MemexAI:
    def __init__(
        self,
        url: str,
        api_key: str,
        client: Optional[httpx.AsyncClient] = None,
        timeout: Optional[float] = None,
    ):
        if not url:
            raise MemexError("INVALID_OPTIONS", "url is required")
        if not api_key:
            raise MemexError("INVALID_OPTIONS", "api_key is required")

        self.base_url = url.rstrip("/")
        self.api_key = api_key
        self._client = client or httpx.AsyncClient(timeout=timeout)
        self._owns_client = client is None

    def for_user(self, user_id: Union[str, MemoryContext, Dict[str, Any]], actor: Optional[str] = None) -> "MemexAIMemory":
        if isinstance(user_id, MemoryContext):
            context = _context_to_dict(user_id)
        elif isinstance(user_id, dict):
            context = _normalize_context(user_id)
        else:
            context = {"userId": user_id, "actor": actor}

        if not context.get("userId"):
            raise MemexError("USER_ID_REQUIRED", "userId is required")
        return MemexAIMemory(self, context)

    async def request(self, path: str, method: str = "GET", json_body: Optional[Dict[str, Any]] = None) -> Any:
        response = await self._client.request(
            method,
            f"{self.base_url}{path}",
            headers={"authorization": f"Bearer {self.api_key}"},
            json=json_body,
        )

        body_text = response.text
        body = _parse_json(body_text) if body_text else None

        if response.is_error:
            error = body.get("error") if isinstance(body, dict) else None
            code = error.get("code") if isinstance(error, dict) else f"HTTP_{response.status_code}"
            message = error.get("message") if isinstance(error, dict) else response.reason_phrase
            details = error.get("issues") if isinstance(error, dict) else None
            raise MemexError(code or f"HTTP_{response.status_code}", message or response.reason_phrase, response.status_code, details)

        return body

    async def execute_tool(self, name: str, arguments: Dict[str, Any], context: Dict[str, Any]) -> Any:
        return await self.request(
            f"/v1/tools/{quote(name, safe='')}/execute",
            method="POST",
            json_body={
                "context": context,
                "arguments": arguments,
            },
        )

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()


class MemexAIMemory:
    def __init__(self, client: MemexAI, context: Dict[str, Any]):
        self.client = client
        self.memex = client
        self.context = context
        self.ctx = context

    async def get_prompt_block(self) -> str:
        params = {"userId": self.context["userId"]}
        if self.context.get("actor"):
            params["actor"] = self.context["actor"]
        result = await self.client.request(f"/v1/prompt-block?{urlencode(params)}")
        return result["promptBlock"]

    async def list_files(self, prefix: Optional[str] = None) -> Dict[str, Any]:
        args = {}
        if prefix:
            args["prefix"] = prefix
        return await self.execute_tool("memory_list", args)

    async def read_file(self, path: str) -> Dict[str, Any]:
        return await self.execute_tool("memory_read", {"path": path})

    async def write_file(
        self,
        path: str,
        content: str,
        reason: Optional[str] = None,
        tool_call_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        args = {"path": path, "content": content}
        if reason:
            args["reason"] = reason
        return await self.execute_tool("memory_write", args, tool_call_id=tool_call_id)

    async def patch_file(
        self,
        path: str,
        operation: str,
        tool_call_id: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        args = {"path": path, "operation": operation, **kwargs}
        return await self.execute_tool("memory_patch", args, tool_call_id=tool_call_id)

    async def search(self, query: Union[str, Dict[str, Any]], tool_call_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        args = {"query": query, **kwargs} if isinstance(query, str) else {**query, **kwargs}
        tool_id = args.pop("tool_call_id", tool_call_id)
        return await self.execute_tool("memory_search", args, tool_call_id=tool_id)

    async def memorize(self, text: Union[str, Dict[str, Any]], tool_call_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        args = {"text": text, **kwargs} if isinstance(text, str) else {**text, **kwargs}
        tool_id = args.pop("tool_call_id", tool_call_id)
        return await self.execute_tool("memory_memorize", args, tool_call_id=tool_id)

    async def execute_tool(self, tool_name: str, args: Dict[str, Any], tool_call_id: Optional[str] = None) -> Any:
        return await self.client.execute_tool(
            tool_name,
            args,
            _with_tool_call_id(self.context, tool_call_id),
        )


def _parse_json(body_text: str) -> Any:
    try:
        return json.loads(body_text)
    except json.JSONDecodeError:
        raise MemexError("INVALID_JSON_RESPONSE", "MemexAI service returned invalid JSON")


def _context_to_dict(ctx: MemoryContext) -> Dict[str, Any]:
    return ctx.model_dump(by_alias=True, exclude_none=True)


def _normalize_context(ctx: Dict[str, Any]) -> Dict[str, Any]:
    user_id = ctx.get("userId") or ctx.get("user_id")
    actor = ctx.get("actor")
    tool_call_id = ctx.get("toolCallId") or ctx.get("tool_call_id")
    context = {"userId": user_id, "actor": actor}
    if tool_call_id:
        context["toolCallId"] = tool_call_id
    return context


def _with_tool_call_id(context: Dict[str, Any], tool_call_id: Optional[str]) -> Dict[str, Any]:
    if not tool_call_id:
        return dict(context)
    return {**context, "toolCallId": tool_call_id}
