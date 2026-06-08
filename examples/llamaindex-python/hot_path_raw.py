import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from llama_index.core.agent.workflow import FunctionAgent
from llama_index.llms.google_genai import GoogleGenAI
from memexai import MemexAI
from memexai.adapters.llamaindex import get_llamaindex_tools

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
            os.getenv("MEMEX_USER_ID", "llamaindex_raw_user"),
            actor="llamaindex-hot-path-raw",
        )
        await memory.write_file(
            "user/preferences.md",
            "# Preferences\n\n",
            reason="seed raw-mode memory schema",
        )

        # Mode="raw" provides memory_write, memory_read, memory_find, memory_patch
        tools = [
            tool
            for tool in get_llamaindex_tools(memory, mode="raw")
            if tool.metadata.name in {"memory_write", "memory_read", "memory_find"}
        ]
        
        system_prompt = await memory.get_system_prompt(
            "\n".join([
                "You are a LlamaIndex agent with direct file-level MemexAI memory tools.",
                "When the user asks you to save a preference, write it under user/preferences.md.",
                "Use memory_find or memory_read before answering questions that depend on stored memory.",
                "Use memory_write for this demo; do not call memory_patch.",
            ])
        )

        llm = GoogleGenAI(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        )

        agent = FunctionAgent(
            name="MemexLlamaIndexRawAgent",
            description="A minimal LlamaIndex agent with durable MemexAI memory.",
            llm=llm,
            tools=tools,
            system_prompt=system_prompt,
        )

        print("Turn 1: remember")
        remember_response = await agent.run(user_msg="Save this preference: I prefer 2BHK apartments near metro stations.")
        print(str(remember_response))

        print("\nTurn 2: recall")
        recall_response = await agent.run(user_msg="Read memory and tell me my apartment preference.")
        print(str(recall_response))

        print("\nFiles:")
        files = await memory.list_files(prefix="user/")
        for file_info in files.get("files", []):
            print(f"- {file_info.get('path')}")

    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
