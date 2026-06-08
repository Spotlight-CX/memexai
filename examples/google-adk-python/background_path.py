import asyncio
import os
from types import SimpleNamespace
from pathlib import Path

from memexai import MemexAI
from memexai.adapters.google_adk import MemexAdkMemoryService


from dotenv import load_dotenv

async def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")
    load_dotenv(Path(__file__).with_name(".env"), override=True)
    memex_url = os.getenv("MEMEX_URL") or f"http://localhost:{os.getenv('MEMEX_PORT', '8080')}"
    memex = MemexAI(url=memex_url, api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"))
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
