import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.google_genai import GoogleGenAI
from memexai import MemexAI
from memexai.adapters.llamaindex import get_llamaindex_tools

def pick_agentic_tools(tools):
    return [tool for tool in tools if tool.metadata.name in {"memory_remember", "memory_context"}]

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
            os.getenv("MEMEX_USER_ID", "llamaindex_subagent_user"),
            actor="llamaindex-hot-path-subagent",
        )

        tools = pick_agentic_tools(get_llamaindex_tools(memory, mode="subagent"))
        
        system_prompt = await memory.get_system_prompt(
            "\n".join([
                "You are a concise LlamaIndex agent with durable MemexAI memory.",
                "Use memory_remember when the user gives a stable preference or asks you to remember something.",
                "Use memory_context before answering questions that may depend on prior memory.",
                "Do not mention implementation details.",
            ])
        )

        llm = GoogleGenAI(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        )

        agent = FunctionAgent(
            name="MemexLlamaIndexSubagent",
            description="A minimal LlamaIndex agent with durable MemexAI memory.",
            llm=llm,
            tools=tools,
            system_prompt=system_prompt,
        )

        print("Turn 1: remember")
        remember_response = await agent.run(user_msg="Remember that I prefer 2BHK apartments near metro stations.")
        print(str(remember_response))

        print("\nTurn 2: recall")
        recall_response = await agent.run(user_msg="What apartment type and location do I prefer?")
        print(str(recall_response))

        print("\nFiles:")
        files = await memory.list_files(prefix="user/")
        for file_info in files.get("files", []):
            print(f"- {file_info.get('path')}")

    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
