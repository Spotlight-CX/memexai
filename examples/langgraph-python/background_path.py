import asyncio
import os

from dotenv import load_dotenv
from memexai import MemexAI


async def main() -> None:
    load_dotenv()
    memex_url = os.getenv("MEMEX_URL") or f"http://localhost:{os.getenv('MEMEX_PORT', '8080')}"
    memex = MemexAI(url=memex_url, api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"))
    try:
        memory = memex.for_user(os.getenv("MEMEX_USER_ID", "langgraph_background_user"), actor="langgraph-background-path")
        print("background_path: a later graph node extracts from accepted messages/tool results")
        result = await memory.remember("LangGraph tool-node durable fact: calendar API rejects recurring events without timezone.")
        print(result.get("writes", []))
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
