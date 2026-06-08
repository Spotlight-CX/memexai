import asyncio
import json
import os
from pathlib import Path

import httpx
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService, Session
from google.adk.tools import load_memory
from google.genai.types import Content, Part
from memexai import MemexAI
from memexai.adapters.google_adk import MemexAdkMemoryService

APP_NAME = "memexai_adk_example"

def get_config() -> dict[str, str]:
    repo_root = Path(__file__).resolve().parents[2]
    env_file = repo_root / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if not line or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

    gemini_api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required")

    os.environ.setdefault("GOOGLE_API_KEY", gemini_api_key)
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "FALSE")

    return {
        "memex_url": os.environ.get("MEMEX_URL") or f"http://localhost:{os.environ.get('MEMEX_PORT', '8080')}",
        "memex_api_key": os.environ.get("MEMEX_API_KEY", "dev-agent-key"),
        "user_id": os.environ.get("MEMEX_USER_ID", "adk_subagent_user"),
        "model": os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
    }

async def assert_service_ready(memex_url: str, api_key: str, user_id: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        health = await client.get(f"{memex_url.rstrip('/')}/health")
        health.raise_for_status()

def build_agent(model: str, *, recall: bool) -> Agent:
    if recall:
        return Agent(
            model=model,
            name="memexai_recall_agent",
            instruction=(
                "You answer from durable memory. Use the load_memory tool before "
                "answering, then cite the remembered detail plainly."
            ),
            tools=[load_memory],
        )
    return Agent(
        model=model,
        name="memexai_remember_agent",
        instruction=(
            "You are a concise assistant. When the user gives a durable preference "
            "or project fact, acknowledge it in one sentence."
        ),
    )

async def run_turn(
    *,
    prompt: str,
    user_id: str,
    model: str,
    memory_service: MemexAdkMemoryService,
    recall: bool,
    session_id: str,
) -> tuple[str, Session]:
    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    runner = Runner(
        agent=build_agent(model, recall=recall),
        app_name=APP_NAME,
        session_service=session_service,
        memory_service=memory_service,
    )

    final_text = "(no final response)"
    message = Content(role="user", parts=[Part(text=prompt)])
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_text = event.content.parts[0].text or final_text

    session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    return final_text, session

async def main() -> None:
    config = get_config()
    await assert_service_ready(config["memex_url"], config["memex_api_key"], config["user_id"])

    memex = MemexAI(url=config["memex_url"], api_key=config["memex_api_key"])
    memory_service = MemexAdkMemoryService(
        memex,
        actor="google-adk-subagent",
        max_writes=3,
        max_chars=4000,
    )

    try:
        print("Turn 1: remember")
        remember_text = "Remember that I prefer 2BHK apartments near metro stations."
        answer, session = await run_turn(
            prompt=remember_text,
            user_id=config["user_id"],
            model=config["model"],
            memory_service=memory_service,
            recall=False,
            session_id="remember",
        )
        await memory_service.add_session_to_memory(session)
        print("Remember:", answer)

        print("\nTurn 2: recall")
        recall_text = "What apartment type and location do I prefer?"
        answer, _session = await run_turn(
            prompt=recall_text,
            user_id=config["user_id"],
            model=config["model"],
            memory_service=memory_service,
            recall=True,
            session_id="recall",
        )
        print("Recall:", answer)

        print("\nFiles:")
        memory = memex.for_user(config["user_id"], actor="google-adk-subagent")
        files = await memory.list_files(prefix="user/")
        for f in files.get("files", []):
            print(f"- {f.get('path')}")
            
    finally:
        await memex.close()

if __name__ == "__main__":
    asyncio.run(main())
