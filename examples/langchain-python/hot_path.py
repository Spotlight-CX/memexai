import asyncio
import os

from dotenv import load_dotenv
from memexai import MemexAI


async def main() -> None:
    load_dotenv()
    memex = MemexAI(
        url=os.getenv("MEMEX_URL", "http://localhost:8080"),
        api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"),
        timeout=30,
    )
    try:
        memory = memex.for_user(os.getenv("MEMEX_USER_ID", "langchain_hot_path_user"), actor="langchain-hot-path")
        result = await memory.remember("Remember that I prefer LangChain runnable wrappers for memory.")
        print("hot_path: await memory.remember inside the runnable/callback when durability is part of the turn")
        print(result.get("writes", []))
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
