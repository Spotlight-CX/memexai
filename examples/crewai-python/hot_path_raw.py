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
        memory = memex.for_user(user_id, actor="crewai-hot-path-raw")
        if call == "write_file":
            return await memory.write_file(**args)
        if call == "read_file":
            return await memory.read_file(**args)
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
    user_id = os.getenv("MEMEX_USER_ID", "crewai_raw_user")
    crewai_model = os.getenv("CREWAI_MODEL", "gemini/gemini-2.5-flash")

    # Sync tool wrappers for CrewAI raw mode tools
    @tool("memory_write")
    def memory_write(path: str, content: str, reason: str) -> str:
        """Write content to a file in memory."""
        result = call_memory(memex_url, memex_api_key, user_id, "write_file", {"path": path, "content": content, "reason": reason})
        return json.dumps(result, indent=2, default=str)

    @tool("memory_read")
    def memory_read(path: str) -> str:
        """Read content from a file in memory."""
        result = call_memory(memex_url, memex_api_key, user_id, "read_file", {"path": path})
        return json.dumps(result, indent=2, default=str)

    tools = [memory_write, memory_read]

    llm = LLM(model=crewai_model, api_key=gemini_api_key, temperature=0)

    agent = Agent(
        role="Personal Memory Assistant",
        goal="Store durable user preferences in files and recall them from MemexAI when asked.",
        backstory=(
            "You are careful with long-term memory. You save stable preferences to user/preferences.md, "
            "read files before answering recall questions, and avoid inventing facts."
        ),
        tools=tools,
        llm=llm,
        allow_delegation=False,
        max_iter=4,
        verbose=False,
    )

    print("Turn 1: remember")
    remember_task = Task(
        description="User said: Remember that I prefer 2BHK apartments near metro stations. Save it to user/preferences.md using memory_write.",
        expected_output="A one-sentence confirmation that the preference was saved to a file.",
        agent=agent,
    )
    crew1 = Crew(agents=[agent], tasks=[remember_task], process=Process.sequential, verbose=False)
    print("Remember:", str(crew1.kickoff()))

    print("\nTurn 2: recall")
    recall_task = Task(
        description="User asked: What apartment preference should you remember for me? Read user/preferences.md using memory_read.",
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
