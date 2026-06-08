import asyncio
import os

import httpx
from dotenv import load_dotenv
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.google_genai import GoogleGenAI
from memexai import MemexAI
from memexai.adapters.llamaindex import get_llamaindex_tools


REMEMBER_FACT = "Remember that my preferred apartment configuration is a 2BHK with morning sunlight."
RECALL_QUESTION = "What apartment configuration do I prefer, including any sunlight preference?"


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required. Add it to .env or export it before running.")
    return value


def pick_agentic_tools(tools):
    return [tool for tool in tools if tool.metadata.name in {"memory_remember", "memory_context"}]


async def check_service(memex_url: str, api_key: str, user_id: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        health = await client.get(f"{memex_url}/health")
        health.raise_for_status()

        listing = await client.post(
            f"{memex_url}/v1/tools/memory_list/execute",
            headers={"authorization": f"Bearer {api_key}"},
            json={
                "context": {"userId": user_id, "actor": "llamaindex-python"},
                "arguments": {"prefix": "user/"},
            },
        )
        listing.raise_for_status()


async def main() -> None:
    load_dotenv()

    memex_url = os.getenv("MEMEX_URL", "http://localhost:8080").rstrip("/")
    api_key = os.getenv("MEMEX_API_KEY", "dev-agent-key")
    # Today this identifies the agent/user memory namespace in MemexAI; term may change later.
    user_id = os.getenv("MEMEX_USER_ID", "llamaindex_python_demo_user")
    gemini_api_key = require_env("GEMINI_API_KEY")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    os.environ.pop("GOOGLE_API_KEY", None)

    await check_service(memex_url, api_key, user_id)

    memex = MemexAI(url=memex_url, api_key=api_key)
    memory = memex.for_user(user_id, actor="llamaindex-python")
    tools = pick_agentic_tools(get_llamaindex_tools(memory, mode="subagent"))

    llm = GoogleGenAI(model=model, api_key=gemini_api_key)
    agent = FunctionAgent(
        name="MemexLlamaIndexDemo",
        description="A minimal LlamaIndex agent with durable MemexAI memory.",
        llm=llm,
        tools=tools,
        system_prompt=(
            "You are a concise terminal assistant. Use memory_remember for durable user preferences "
            "and memory_context before answering questions that may depend on previous turns."
        ),
    )

    try:
        print("Turn 1: remember")
        remember_response = await agent.run(user_msg=REMEMBER_FACT)
        print(str(remember_response))

        # A production chat loop often runs remember after each turn so durable facts are captured
        # even when the model answered directly. MemexAI can no-op or merge when the fact is duplicate.
        await memory.remember({
            "text": f"Post-response durable fact: {REMEMBER_FACT}",
            "maxWrites": 2,
        })

        print("\nTurn 2: recall")
        recall_response = await agent.run(user_msg=RECALL_QUESTION)
        print(str(recall_response))

        files = await memory.list_files(prefix="user/")
        print("\nMemexAI user files:")
        for file_info in files.get("files", []):
            print(f"- {file_info.get('path')}")
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
