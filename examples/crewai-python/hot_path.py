import asyncio
import os

from dotenv import load_dotenv
from memexai import MemexAI


async def main() -> None:
    load_dotenv()
    memex = MemexAI(url=os.getenv("MEMEX_URL", "http://localhost:8080"), api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"))
    try:
        memory = memex.for_user(os.getenv("MEMEX_USER_ID", "crewai_hot_path_user"), actor="crewai-hot-path")
        result = await memory.remember("Remember that I prefer CrewAI task outputs summarized before saving.")
        print("hot_path: await memory.remember during a task when the task promise includes durable save")
        print(result.get("writes", []))
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
