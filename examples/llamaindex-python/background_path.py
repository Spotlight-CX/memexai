import asyncio
import os

from dotenv import load_dotenv
from memexai import MemexAI


async def main() -> None:
    load_dotenv()
    memex = MemexAI(url=os.getenv("MEMEX_URL", "http://localhost:8080"), api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"))
    try:
        memory = memex.for_user(os.getenv("MEMEX_USER_ID", "llamaindex_background_user"), actor="llamaindex-background-path")
        print("background_path: after the LlamaIndex response, a workflow step extracts reusable facts")
        result = await memory.remember("LlamaIndex connector permanent failure: the source API caps page size at 100 items.")
        print(result.get("writes", []))
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
