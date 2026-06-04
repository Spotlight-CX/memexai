import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from memexai import MemexAI
from memexai.adapters.langchain import get_langchain_tools


DEFAULT_REMEMBER = "Remember that I prefer 2BHK apartments near metro stations."
DEFAULT_RECALL = "What apartment type and location do I prefer?"
AGENTIC_TOOL_NAMES = {"memory_memorize", "memory_search"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the MemexAI LangChain Python service-mode demo.")
    parser.add_argument("--remember", default=DEFAULT_REMEMBER, help="First-turn text the agent should store.")
    parser.add_argument("--recall", default=DEFAULT_RECALL, help="Second-turn question the agent should answer from memory.")
    parser.add_argument("--memex-url", default=os.environ.get("MEMEX_URL", "http://localhost:8080"))
    parser.add_argument("--api-key", default=os.environ.get("MEMEX_API_KEY", "dev-agent-key"))
    parser.add_argument("--user-id", default=os.environ.get("MEMEX_USER_ID", "langchain_python_demo_user"))
    parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
    return parser.parse_args()


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is required. Put it in examples/langchain-python/.env or export it.")
    return value


def content_text(message: Any) -> str:
    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return str(content)


def final_answer(result: dict[str, Any]) -> str:
    messages = result.get("messages", [])
    for message in reversed(messages):
        if isinstance(message, AIMessage):
            text = content_text(message).strip()
            if text:
                return text
    return str(result)


async def run_turn(agent: Any, text: str) -> str:
    result = await agent.ainvoke({"messages": [{"role": "user", "content": text}]})
    return final_answer(result)


async def main() -> None:
    load_dotenv(Path(__file__).with_name(".env"))
    args = parse_args()
    gemini_api_key = require_env("GEMINI_API_KEY")

    memex = MemexAI(url=args.memex_url, api_key=args.api_key, timeout=30)
    try:
        await memex.request("/health")

        # Today this identifies the agent/user memory namespace in MemexAI; term may change later.
        memory = memex.for_user(args.user_id, actor="langchain-python-example")
        ensure_memexai_adapter_compat()
        all_tools = get_langchain_tools(memory)
        tools = [tool for tool in all_tools if tool.name in AGENTIC_TOOL_NAMES]
        if {tool.name for tool in tools} != AGENTIC_TOOL_NAMES:
            raise RuntimeError("Expected memory_memorize and memory_search tools from the MemexAI LangChain adapter.")

        system_prompt = await memory.get_system_prompt(
            "\n".join(
                [
                    "You are a concise terminal demo agent with durable user memory.",
                    "When the user asks you to remember a stable preference, call memory_memorize exactly once.",
                    "When the user asks what you remember, call memory_search before answering.",
                    "Answer in one short sentence after any memory tool calls.",
                ]
            )
        )

        llm = ChatGoogleGenerativeAI(model=args.model, api_key=gemini_api_key, temperature=0)
        agent = create_agent(model=llm, tools=tools, system_prompt=system_prompt)

        print(f"MemexAI service: {args.memex_url}")
        print(f"User namespace: {args.user_id}")

        print("\nTurn 1 - remember")
        remember_answer = await run_turn(agent, args.remember)
        print(f"Assistant: {remember_answer}")

        print("\nTurn 2 - recall")
        recall_answer = await run_turn(agent, args.recall)
        print(f"Assistant: {recall_answer}")

        files = await memory.list_files(prefix="user/")
        print("\nMemexAI inspection")
        print(f"- API files: {files}")
        print(f"- Admin UI: {args.memex_url}/admin")

        # Some production apps run memory_memorize after each user turn instead of asking
        # the agent to do it inline. If you do that, dedupe stable facts first so repeated
        # conversations do not create unnecessary memory revisions.
    finally:
        await memex.close()


def ensure_memexai_adapter_compat() -> None:
    try:
        import langchain.tools as langchain_tools
        from langchain_core.tools import StructuredTool
    except ImportError:
        return
    if not hasattr(langchain_tools, "StructuredTool"):
        langchain_tools.StructuredTool = StructuredTool


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
