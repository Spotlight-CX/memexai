import asyncio
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import InMemorySaver
from memexai import MemexAI
from memexai.adapters.langchain import get_langchain_tools


def final_answer(result: dict[str, Any]) -> str:
    for message in reversed(result.get("messages", [])):
        if isinstance(message, AIMessage):
            return content_text(message.content)
    return str(result)


def content_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts).strip()
    return str(content).strip()


async def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")
    load_dotenv(Path(__file__).with_name(".env"), override=True)
    memex_url = os.getenv("MEMEX_URL") or f"http://localhost:{os.getenv('MEMEX_PORT', '8080')}"

    memex = MemexAI(
        url=memex_url,
        api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"),
        timeout=30,
    )

    try:
        memory = memex.for_user(
            os.getenv("MEMEX_USER_ID", "langchain_raw_user"),
            actor="langchain-hot-path-raw",
        )
        await memory.write_file(
            "user/preferences.md",
            "# Preferences\n\n",
            reason="seed raw-mode memory schema",
        )

        tools = [
            tool
            for tool in get_langchain_tools(memory, mode="raw")
            if tool.name in {"memory_write", "memory_read", "memory_find"}
        ]
        system_prompt = await memory.get_system_prompt(
            "\n".join([
                "You are a LangChain agent with direct file-level MemexAI memory tools.",
                "When the user asks you to save a preference, write it under user/preferences.md.",
                "Use memory_find or memory_read before answering questions that depend on stored memory.",
                "Use memory_write for this demo; do not call memory_patch.",
            ])
        )

        llm = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL") or os.getenv("GOOGLE_VERTEX_MODEL", "gemini-2.5-flash"),
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ["GOOGLE_API_KEY"],
            temperature=0,
        )

        agent = create_agent(
            model=llm,
            tools=tools,
            system_prompt=system_prompt,
            checkpointer=InMemorySaver(),
        )

        config = {"configurable": {"thread_id": "raw-demo-thread"}}

        remember = await agent.ainvoke(
            {"messages": [{"role": "user", "content": "Save this preference: I prefer 2BHK apartments near metro stations."}]},
            config,
        )
        print("Raw write:", final_answer(remember))

        recall = await agent.ainvoke(
            {"messages": [{"role": "user", "content": "Read memory and tell me my apartment preference."}]},
            config,
        )
        print("Raw recall:", final_answer(recall))
        print("Files:", await memory.list_files(prefix="user/"))

    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
