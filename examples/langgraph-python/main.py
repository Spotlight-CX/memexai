from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

import httpx
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import InMemorySaver
from memexai import MemexAI
from memexai.adapters.langchain import get_langchain_tools


REMEMBER_FACT = "Remember that I prefer 2BHK apartments near metro stations."
RECALL_PROMPT = "What kind of apartment do I prefer? Answer from memory in one short sentence."


@dataclass(frozen=True)
class Settings:
    memex_url: str
    memex_api_key: str
    memex_admin_secret: str | None
    memex_user_id: str
    gemini_api_key: str
    gemini_model: str


def load_settings() -> Settings:
    load_dotenv()
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required. Put it in examples/langgraph-python/.env.")

    return Settings(
        memex_url=os.getenv("MEMEX_URL", "http://localhost:8080").rstrip("/"),
        memex_api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"),
        memex_admin_secret=os.getenv("MEMEX_ADMIN_SECRET") or None,
        # Today this identifies the agent/user memory namespace in MemexAI; term may change later.
        memex_user_id=os.getenv("MEMEX_USER_ID", "langgraph_python_demo_user"),
        gemini_api_key=gemini_api_key,
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    )


async def check_service(settings: Settings, memory: Any) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        health = await client.get(f"{settings.memex_url}/health")
        health.raise_for_status()

    files = await memory.list_files(prefix="user/")
    print(f"MemexAI service: {settings.memex_url} ({health.json().get('ok', 'ok')})")
    print(f"memory_list visible files: {len(files.get('files', []))}")


async def admin_files(settings: Settings) -> list[dict[str, Any]]:
    if not settings.memex_admin_secret:
        return []

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.memex_url}/v1/admin/files",
            headers={"x-admin-secret": settings.memex_admin_secret},
        )
        response.raise_for_status()
        body = response.json()
        return body.get("files", [])


def pick_memex_tools(memory: Any) -> list[Any]:
    # MemexAI's current adapter supports LangChain 0.2/0.3 import paths. LangChain
    # v1 keeps StructuredTool in langchain_core.tools, so bridge that symbol locally
    # until the SDK can support both paths directly.
    import langchain.tools as langchain_tools
    from langchain_core.tools import StructuredTool

    if not hasattr(langchain_tools, "StructuredTool"):
        langchain_tools.StructuredTool = StructuredTool

    tools = get_langchain_tools(memory, mode="subagent")
    wanted = {"memory_remember", "memory_context"}
    return [tool for tool in tools if tool.name in wanted]


async def build_agent(memory: Any, settings: Settings):
    system = await memory.get_system_prompt(
        "\n".join(
            [
                "You are a concise assistant with durable MemexAI memory.",
                "When the user asks you to remember a stable preference, call memory_remember before replying.",
                "When the user asks what you know from memory, call memory_context before replying.",
                "Keep final answers short and do not mention implementation details.",
            ]
        )
    )
    model = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        api_key=settings.gemini_api_key,
        temperature=0,
    )

    return create_agent(
        model=model,
        tools=pick_memex_tools(memory),
        system_prompt=system,
        checkpointer=InMemorySaver(),
    )


async def run_turn(memory: Any, settings: Settings, prompt: str) -> str:
    agent = await build_agent(memory, settings)
    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": prompt}]},
        config={"configurable": {"thread_id": str(uuid4())}},
    )
    message = result["messages"][-1]
    return getattr(message, "text", None) or str(message.content)


async def verify_expected_memory(memory: Any) -> bool:
    result = await memory.find("2BHK apartments near metro stations")
    rendered = str(result).lower()
    return "2bhk" in rendered and "metro" in rendered


async def extraction_node(memory: Any, user_text: str, assistant_text: str) -> None:
    compact = (
        "LangGraph post-turn durable fact candidate:\n"
        f"user: {user_text}\n"
        f"assistant: {assistant_text}"
    )
    await memory.remember({"text": compact, "maxWrites": 2})


async def main() -> None:
    settings = load_settings()
    memex = MemexAI(url=settings.memex_url, api_key=settings.memex_api_key)
    memory = memex.for_user(settings.memex_user_id, actor="langgraph-python-example")

    try:
        await check_service(settings, memory)

        print("\nTurn 1: remember")
        remember_answer = await run_turn(memory, settings, REMEMBER_FACT)
        print(f"Assistant: {remember_answer}")
        await extraction_node(memory, REMEMBER_FACT, remember_answer)

        # In a larger graph, extraction_node would be a dedicated node after accepted
        # assistant turns or app tool results. Keep it app-owned so you can filter
        # transient failures, secrets, and duplicate facts before calling MemexAI.
        if not await verify_expected_memory(memory):
            raise RuntimeError("The remember turn finished, but MemexAI search did not find the expected preference.")

        print("\nTurn 2: recall")
        recall_answer = await run_turn(memory, settings, RECALL_PROMPT)
        print(f"Assistant: {recall_answer}")

        expected = "2bhk" in recall_answer.lower() and "metro" in recall_answer.lower()
        if not expected:
            raise RuntimeError("Recall answer did not include the expected 2BHK/metro preference.")

        files = await admin_files(settings)
        user_files = [
            file for file in files
            if settings.memex_user_id in str(file.get("physicalPath") or file.get("physical_path") or "")
        ]
        if files:
            print(f"\nAdmin files visible for demo user: {len(user_files)}")
        else:
            print("\nAdmin file verification skipped; set MEMEX_ADMIN_SECRET to enable it.")

        print("\nSmoke check passed.")
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
