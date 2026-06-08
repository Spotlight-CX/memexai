import asyncio
import os

from memexai import MemexAI


async def main() -> None:
    memex = MemexAI(url=os.getenv("MEMEX_URL", "http://localhost:8080"), api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"))
    try:
        memory = memex.for_user(os.getenv("MEMEX_USER_ID", "adk_hot_path_user"), actor="google-adk-hot-path")
        result = await memory.remember("Remember that ADK hot-path memory is for explicit current-turn saves.")
        print("hot_path: call memory.remember from an ADK action/tool when durability is part of the current turn")
        print(result.get("writes", []))
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
