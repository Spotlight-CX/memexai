from typing import Any, Optional

try:
    from google.adk.memory import BaseMemoryService as _BaseMemoryService
except ImportError:
    _BaseMemoryService = object


class MemexAdkMemoryService(_BaseMemoryService):
    def __init__(
        self,
        memex: Any,
        *,
        actor: str = "google-adk",
        max_writes: int = 3,
        max_chars: int = 4000,
        use_context: bool = True,
    ):
        if _BaseMemoryService is object:
            raise ImportError("google-adk is not installed. Please install it to use this adapter.")

        self.memex = memex
        self.actor = actor
        self.max_writes = max_writes
        self.max_chars = max_chars
        self.use_context = use_context

    async def add_session_to_memory(self, session: Any) -> None:
        text = session_to_text(session)
        if not text:
            return

        memory = self.memex.for_user(session_user_id(session), actor=self.actor)
        await memory.remember(
            {
                "text": text,
                "maxWrites": self.max_writes,
            },
            tool_call_id=f"adk-session-{session.id}",
        )

    async def search_memory(self, *, app_name: str, user_id: str, query: str) -> Any:
        try:
            from google.adk.memory.base_memory_service import SearchMemoryResponse
            from google.adk.memory.memory_entry import MemoryEntry
            from google.genai.types import Content, Part
        except ImportError:
            raise ImportError("google-adk is not installed. Please install it to use this adapter.")

        memory = self.memex.for_user(user_id, actor=self.actor)
        entries = []

        if self.use_context:
            result = await memory.retrieve_context({"query": query, "maxChars": self.max_chars})
            content = result.get("content") or result.get("context")
            if content:
                entries.append(_memory_entry(MemoryEntry, Content, Part, content, author="memexai-memory_context"))
        else:
            result = await memory.find({"query": query, "limit": 5, "maxChars": self.max_chars})
            for item in result.get("results", []):
                snippet = f"{item.get('path')}: {item.get('snippet')}"
                entries.append(_memory_entry(MemoryEntry, Content, Part, snippet, author="memexai-memory_find"))

        return SearchMemoryResponse(memories=entries)


def create_adk_memory_service(memex: Any, **kwargs) -> MemexAdkMemoryService:
    return MemexAdkMemoryService(memex, **kwargs)


def session_to_text(session: Any) -> str:
    lines = []
    for event in getattr(session, "events", []) or []:
        content = getattr(event, "content", None)
        parts = getattr(content, "parts", None)
        if not parts:
            continue
        text = " ".join(part.text for part in parts if getattr(part, "text", None))
        if text:
            lines.append(f"{event.author}: {text}")
    return "\n".join(lines)


def session_user_id(session: Any) -> str:
    user_id: Optional[str] = getattr(session, "user_id", None) or getattr(session, "userId", None)
    if not user_id:
        raise ValueError("ADK session is missing user_id")
    return user_id


def _memory_entry(MemoryEntry: Any, Content: Any, Part: Any, text: str, *, author: str) -> Any:
    return MemoryEntry(
        content=Content(role="model", parts=[Part(text=text)]),
        author=author,
    )
