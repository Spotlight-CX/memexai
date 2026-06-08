import asyncio
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain_core.messages import AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.prebuilt import create_react_agent
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
            os.getenv("MEMEX_USER_ID", "langgraph_subagent_user"),
            actor="langgraph-hot-path-subagent",
        )

        # Mode="subagent" provides memory_remember and memory_context
        tools = get_langchain_tools(memory, mode="subagent")
        system_prompt = await memory.get_system_prompt(
            "\n".join([
                "You are a concise LangGraph agent with durable MemexAI memory.",
                "Use memory_remember when the user gives a stable preference or asks you to remember something.",
                "Use memory_context before answering questions that may depend on prior memory.",
                "Do not mention implementation details.",
            ])
        )

        llm = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL") or os.getenv("GOOGLE_VERTEX_MODEL", "gemini-2.5-flash"),
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ["GOOGLE_API_KEY"],
            temperature=0,
        )

        agent = create_react_agent(
            model=llm,
            tools=tools,
            prompt=system_prompt,
            checkpointer=InMemorySaver(),
        )

        config = {"configurable": {"thread_id": "subagent-demo-thread"}}

        remember = await agent.ainvoke(
            {"messages": [{"role": "user", "content": "Remember that I prefer 2BHK apartments near metro stations."}]},
            config,
        )
        print("Remember:", final_answer(remember))

        recall = await agent.ainvoke(
            {"messages": [{"role": "user", "content": "What apartment type and location do I prefer?"}]},
            config,
        )
        print("Recall:", final_answer(recall))
        print("Files:", await memory.list_files(prefix="user/"))

    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
