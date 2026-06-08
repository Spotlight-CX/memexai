import asyncio
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from langchain_core.tools import tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import InMemorySaver
from memexai import MemexAI


LAST_TOOL_RESULT: dict[str, Any] | None = None


@tool
def run_sql(query: str) -> str:
    """Run a SQL query against the app database."""
    global LAST_TOOL_RESULT

    if "ILIKE" in query.upper() or "LOWER(" in query.upper() or "RAO" in query.upper():
        LAST_TOOL_RESULT = {
            "tool": "run_sql",
            "ok": False,
            "permanent": True,
            "error": "ILIKE is not supported in this SQL dialect; use LOWER(column) LIKE LOWER(pattern).",
        }
        return LAST_TOOL_RESULT["error"]

    LAST_TOOL_RESULT = {"tool": "run_sql", "ok": True, "permanent": False}
    return "Query completed."


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


def extract_insight(tool_result: dict[str, Any] | None) -> str | None:
    if not tool_result:
        return None
    if tool_result.get("ok") is False and tool_result.get("permanent") is True:
        return f"{tool_result['tool']} permanent failure: {tool_result['error']}"
    return None


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
            os.getenv("MEMEX_USER_ID", "langchain_background_user"),
            actor="langchain-background-extraction",
        )

        llm = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL") or os.getenv("GOOGLE_VERTEX_MODEL", "gemini-2.5-flash"),
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ["GOOGLE_API_KEY"],
            temperature=0,
        )

        agent = create_agent(
            model=llm,
            tools=[run_sql],
            system_prompt=(
                "You are a SQL assistant. Use run_sql for SQL questions before answering. "
                "If a query fails, explain the practical workaround."
            ),
            checkpointer=InMemorySaver(),
        )

        config = {"configurable": {"thread_id": "background-demo-thread"}}

        response = await agent.ainvoke(
            {"messages": [{"role": "user", "content": "Find customers whose name ILIKE '%rao%'."}]},
            config,
        )
        print("Assistant:", final_answer(response))

        insight = extract_insight(LAST_TOOL_RESULT)
        if insight:
            result = await memory.remember({"text": insight, "maxWrites": 2})
            print("Background extraction:", insight)
            print("Writes:", result.get("writes", []))

        context = await memory.retrieve_context({"query": "SQL dialect limitations", "maxChars": 4000})
        print("Recall check:", context.get("content") or context)

    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
