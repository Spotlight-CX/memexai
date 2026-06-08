import asyncio
import json
import os
from pathlib import Path
from typing import Any

from crewai import Agent, Crew, LLM, Process, Task
from crewai.tools import tool
from dotenv import load_dotenv
from memexai import MemexAI


def run_async(coro: Any) -> Any:
    return asyncio.run(coro)


async def _with_memory(memex_url: str, memex_api_key: str, user_id: str, call: str, args: dict[str, Any]) -> Any:
    memex = MemexAI(url=memex_url, api_key=memex_api_key, timeout=30)
    try:
        memory = memex.for_user(user_id, actor="crewai-hot-path-subagent")
        if call == "remember":
            return await memory.remember(args)
        if call == "context":
            return await memory.retrieve_context(args)
        if call == "list":
            return await memory.list_files(prefix=args.get("prefix"))
        raise ValueError(f"Unknown memory call: {call}")
    finally:
        await memex.close()


def call_memory(memex_url: str, memex_api_key: str, user_id: str, call: str, args: dict[str, Any]) -> Any:
    return run_async(_with_memory(memex_url, memex_api_key, user_id, call, args))


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    load_dotenv(repo_root / ".env")
    load_dotenv(Path(__file__).with_name(".env"), override=True)

    gemini_api_key = os.getenv("GEMINI_API_KEY") or os.environ["GOOGLE_API_KEY"]
    os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")

    memex_url = os.getenv("MEMEX_URL") or f"http://localhost:{os.getenv('MEMEX_PORT', '8080')}"
    memex_api_key = os.getenv("MEMEX_API_KEY", "dev-agent-key")
    user_id = os.getenv("MEMEX_USER_ID", "crewai_subagent_user")
    crewai_model = os.getenv("CREWAI_MODEL", "gemini/gemini-2.5-flash")

    # Sync tool wrappers for CrewAI
    @tool("memory_remember")
    def memory_remember(text: str) -> str:
        """Remember durable facts from raw text using MemexAI."""
        result = call_memory(memex_url, memex_api_key, user_id, "remember", {"text": text, "maxWrites": 3})
        return json.dumps(result, indent=2, default=str)

    @tool("memory_context")
    def memory_context(query: str) -> str:
        """Retrieve MemexAI memory context for a question."""
        result = call_memory(memex_url, memex_api_key, user_id, "context", {"query": query, "maxChars": 4000})
        return json.dumps(result, indent=2, default=str)

    tools = [memory_remember, memory_context]

    llm = LLM(model=crewai_model, api_key=gemini_api_key, temperature=0)

    agent = Agent(
        role="Personal Memory Assistant",
        goal="Store durable user preferences and recall them from MemexAI when asked.",
        backstory=(
            "You are careful with long-term memory. You save stable preferences, "
            "search before answering recall questions, and avoid inventing facts."
        ),
        tools=tools,
        llm=llm,
        allow_delegation=False,
        max_iter=4,
        verbose=False,
    )

    print("Turn 1: remember")
    remember_task = Task(
        description="User said: Remember that I prefer 2BHK apartments near metro stations.",
        expected_output="A one-sentence confirmation that the preference was saved.",
        agent=agent,
    )
    crew1 = Crew(agents=[agent], tasks=[remember_task], process=Process.sequential, verbose=False)
    print("Remember:", str(crew1.kickoff()))

    print("\nTurn 2: recall")
    recall_task = Task(
        description="User asked: What apartment preference should you remember for me?",
        expected_output="The stored apartment preference, grounded in MemexAI memory.",
        agent=agent,
    )
    crew2 = Crew(agents=[agent], tasks=[recall_task], process=Process.sequential, verbose=False)
    print("Recall:", str(crew2.kickoff()))

    print("\nFiles:")
    files = call_memory(memex_url, memex_api_key, user_id, "list", {"prefix": "user/"})
    for f in files.get("files", []):
        print(f"- {f.get('path')}")


if __name__ == "__main__":
    main()
