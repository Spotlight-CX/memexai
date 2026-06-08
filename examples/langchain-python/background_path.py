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
        memory = memex.for_user(os.getenv("MEMEX_USER_ID", "langchain_background_user"), actor="langchain-background-path")
        print("background_path: respond first, then a callback/runnable wrapper extracts durable facts")
        insight = "LangChain tool permanent failure: vector store filter syntax does not support nested OR clauses."
        result = await memory.remember({"text": insight, "maxWrites": 2})
        print(result.get("writes", []))
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
