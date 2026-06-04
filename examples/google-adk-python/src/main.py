import argparse
import asyncio
import json
import os
from pathlib import Path

import httpx
from google.adk.agents import Agent
from google.adk.memory import BaseMemoryService
from google.adk.memory.base_memory_service import SearchMemoryResponse
from google.adk.memory.memory_entry import MemoryEntry
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService, Session
from google.adk.tools import load_memory
from google.genai.types import Content, Part
from memexai import MemexAI


APP_NAME = "memexai_adk_example"
DEFAULT_REMEMBER_PROMPT = (
    "Remember that my onboarding checklist must include the Atlas compliance review."
)
DEFAULT_RECALL_PROMPT = "What should my onboarding checklist include?"


def load_dotenv() -> None:
    env_file = Path(__file__).resolve().parents[3] / ".env"
    if not env_file.exists():
        return

    for line in env_file.read_text().splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def get_config() -> dict[str, str]:
    load_dotenv()
    gemini_api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is required")

    # ADK's Gemini integration reads GOOGLE_API_KEY. The rest of this example uses
    # GEMINI_API_KEY because the other MemexAI examples use that name.
    os.environ.setdefault("GOOGLE_API_KEY", gemini_api_key)
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "FALSE")

    return {
        "memex_url": os.environ.get("MEMEX_URL", "http://localhost:8080"),
        "memex_api_key": os.environ.get("MEMEX_API_KEY", "dev-agent-key"),
        # Today this identifies the agent/user memory namespace in MemexAI. The
        # term may change later, so keep app code from treating it as final copy.
        "user_id": os.environ.get("MEMEX_USER_ID", "adk_demo_user"),
        "model": os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
    }


class MemexAdkMemoryService(BaseMemoryService):
    def __init__(self, memex: MemexAI):
        self.memex = memex

    async def add_session_to_memory(self, session: Session) -> None:
        text = session_to_text(session)
        if not text:
            return

        memory = self.memex.for_user(session_user_id(session), actor="google-adk")

        # This is the natural ADK post-turn hook point. In production, call it
        # only for interactions with durable facts; do not blindly memorize every
        # turn. For noisier apps, run memory_search or memory_memorize(dryRun=True)
        # first to reduce duplicate writes.
        await memory.memorize(
            {
                "text": text,
                "maxWrites": 3,
            },
            tool_call_id=f"adk-session-{session.id}",
        )

    async def search_memory(
        self,
        *,
        app_name: str,
        user_id: str,
        query: str,
    ) -> SearchMemoryResponse:
        memory = self.memex.for_user(user_id, actor="google-adk")
        result = await memory.search({"query": query, "limit": 5, "maxChars": 4000})

        entries: list[MemoryEntry] = []
        if result.get("answer"):
            entries.append(memory_entry(result["answer"], author="memexai-memory_search"))

        for item in result.get("results", []):
            snippet = f"{item.get('path')}: {item.get('snippet')}"
            entries.append(memory_entry(snippet, author="memexai-bm25"))

        return SearchMemoryResponse(memories=entries)


def memory_entry(text: str, *, author: str) -> MemoryEntry:
    return MemoryEntry(
        content=Content(role="model", parts=[Part(text=text)]),
        author=author,
    )


def session_to_text(session: Session) -> str:
    lines: list[str] = []
    for event in session.events:
        if not event.content or not event.content.parts:
            continue
        text = " ".join(part.text for part in event.content.parts if getattr(part, "text", None))
        if text:
            lines.append(f"{event.author}: {text}")
    return "\n".join(lines)


def session_user_id(session: Session) -> str:
    return getattr(session, "user_id", None) or getattr(session, "userId")


async def assert_service_ready(memex_url: str, api_key: str, user_id: str) -> None:
    async with httpx.AsyncClient(timeout=10) as client:
        health = await client.get(f"{memex_url.rstrip('/')}/health")
        health.raise_for_status()
        response = await client.post(
            f"{memex_url.rstrip('/')}/v1/tools/memory_list/execute",
            headers={"authorization": f"Bearer {api_key}"},
            json={
                "context": {"userId": user_id, "actor": "google-adk-check"},
                "arguments": {"prefix": "user/"},
            },
        )
        response.raise_for_status()


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
    if session is None:
        raise RuntimeError(f"ADK session {session_id} was not found")
    return final_text, session


async def run(command: str, prompt: str | None) -> None:
    config = get_config()
    await assert_service_ready(config["memex_url"], config["memex_api_key"], config["user_id"])

    memex = MemexAI(url=config["memex_url"], api_key=config["memex_api_key"])
    memory_service = MemexAdkMemoryService(memex)

    try:
        if command in {"remember", "smoke"}:
            remember_text = prompt or DEFAULT_REMEMBER_PROMPT
            answer, session = await run_turn(
                prompt=remember_text,
                user_id=config["user_id"],
                model=config["model"],
                memory_service=memory_service,
                recall=False,
                session_id="remember",
            )
            await memory_service.add_session_to_memory(session)
            print("Remember turn:")
            print(answer)

        if command in {"recall", "smoke"}:
            recall_text = prompt if command == "recall" and prompt else DEFAULT_RECALL_PROMPT
            answer, _session = await run_turn(
                prompt=recall_text,
                user_id=config["user_id"],
                model=config["model"],
                memory_service=memory_service,
                recall=True,
                session_id="recall",
            )
            print("Recall turn:")
            print(answer)

        if command == "inspect":
            memory = memex.for_user(config["user_id"], actor="google-adk-inspect")
            result = await memory.search(DEFAULT_RECALL_PROMPT)
            print(json.dumps(result, indent=2))
    finally:
        await memex.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MemexAI + Google ADK memory example")
    parser.add_argument("command", choices=["remember", "recall", "smoke", "inspect"])
    parser.add_argument("prompt", nargs="?", help="Optional prompt for remember/recall")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(run(args.command, args.prompt))


if __name__ == "__main__":
    main()
