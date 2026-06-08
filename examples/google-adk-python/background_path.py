import asyncio
import os
from types import SimpleNamespace

from memexai import MemexAI
from memexai.adapters.google_adk import MemexAdkMemoryService


async def main() -> None:
    memex = MemexAI(url=os.getenv("MEMEX_URL", "http://localhost:8080"), api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"))
    service = MemexAdkMemoryService(memex, actor="google-adk-background-path")
    try:
        session = SimpleNamespace(
            id="background-example-session",
            user_id=os.getenv("MEMEX_USER_ID", "adk_background_user"),
            events=[
                SimpleNamespace(
                    author="user",
                    content=SimpleNamespace(parts=[SimpleNamespace(text="Remember that ADK should use load_memory for recall.")]),
                ),
                SimpleNamespace(
                    author="model",
                    content=SimpleNamespace(parts=[SimpleNamespace(text="I will use ADK's native memory lifecycle.")]),
                ),
            ],
        )
        await service.add_session_to_memory(session)
        print("background_path: MemexAdkMemoryService saved the completed ADK session")
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
