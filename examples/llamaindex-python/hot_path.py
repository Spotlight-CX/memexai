import asyncio
import os

from dotenv import load_dotenv
from memexai import MemexAI


async def main() -> None:
    load_dotenv()
    memex = MemexAI(url=os.getenv("MEMEX_URL", "http://localhost:8080"), api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"))
    try:
        memory = memex.for_user(os.getenv("MEMEX_USER_ID", "llamaindex_hot_path_user"), actor="llamaindex-hot-path")
        result = await memory.remember("Remember that I prefer LlamaIndex workflow steps for memory extraction.")
        print("hot_path: await memory.remember in the current workflow step")
        print(result.get("writes", []))
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
