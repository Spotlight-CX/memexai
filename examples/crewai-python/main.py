from __future__ import annotations

import json
import os
import sys
from typing import Any, Iterable

import httpx
from crewai import Agent, Crew, LLM, Process, Task
from crewai.tools import tool
from dotenv import load_dotenv
from memexai import MemexAI
from memexai.adapters.crewai import get_crewai_tools


DEFAULT_FACT = "I prefer 2BHK apartments near metro stations."
DEFAULT_RECALL_QUERY = "What apartment preference should you remember for me?"
DEFAULT_USER_ID = "crewai_python_service_demo"
ACTOR = "crewai-python-example"


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"{name} is required. Add it to .env or export it in your shell.")
    return value


async def _check_service(memex_url: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{memex_url}/health")
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise SystemExit(
            f"MemexAI service is not healthy at {memex_url}. "
            "Start it with `docker compose up -d` and confirm the mapped port with `docker compose ps`."
        ) from exc


def run_async(coro: Any) -> Any:
    import asyncio

    return asyncio.run(coro)


def check_service(memex_url: str) -> None:
    run_async(_check_service(memex_url))


def pick_agentic_tools(tools: Iterable[Any]) -> list[Any]:
    selected = []
    for candidate in tools:
        if getattr(candidate, "name", None) in {"memory_memorize", "memory_search"}:
            selected.append(candidate)
    if len(selected) != 2:
        names = [getattr(tool, "name", "<unknown>") for tool in tools]
        raise RuntimeError(f"Expected memory_memorize and memory_search tools, found: {names}")
    return selected


async def _with_memory(memex_url: str, memex_api_key: str, user_id: str, call: str, args: dict[str, Any]) -> Any:
    memex = MemexAI(url=memex_url, api_key=memex_api_key, timeout=60)
    try:
        memory = memex.for_user(user_id, actor=ACTOR)
        if call == "memorize":
            return await memory.memorize(args)
        if call == "search":
            return await memory.search(args)
        if call == "list":
            return await memory.list_files(prefix=args.get("prefix"))
        raise ValueError(f"Unknown memory call: {call}")
    finally:
        await memex.close()


def call_memory(memex_url: str, memex_api_key: str, user_id: str, call: str, args: dict[str, Any]) -> Any:
    return run_async(_with_memory(memex_url, memex_api_key, user_id, call, args))


def build_practical_crewai_tools(memex_url: str, memex_api_key: str, user_id: str) -> list[Any]:
    # The repo adapter exposes async tools. CrewAI 1.14.6 can execute them, but
    # this terminal flow also performs post-turn verification after kickoff; in
    # local smoke testing, that combination closed the httpx event loop. These
    # sync wrappers call the same MemexAI service methods with short-lived clients.
    @tool("memory_memorize")
    def memory_memorize(text: str, maxWrites: int = 3, dryRun: bool = False) -> str:
        """Remember durable facts from raw text using MemexAI."""
        result = call_memory(
            memex_url,
            memex_api_key,
            user_id,
            "memorize",
            {"text": text, "maxWrites": maxWrites, "dryRun": dryRun},
        )
        return json.dumps(result, indent=2, default=str)

    @tool("memory_search")
    def memory_search(query: str, maxChars: int = 4000, limit: int = 5, prefix: str | None = None) -> str:
        """Search MemexAI memory for relevant stored context."""
        args: dict[str, Any] = {"query": query, "maxChars": maxChars, "limit": limit}
        if prefix:
            args["prefix"] = prefix
        result = call_memory(memex_url, memex_api_key, user_id, "search", args)
        return json.dumps(result, indent=2, default=str)

    return [memory_memorize, memory_search]


def build_agent(tools: list[Any], llm: LLM) -> Agent:
    return Agent(
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


def run_task(agent: Agent, description: str, expected_output: str) -> str:
    task = Task(description=description, expected_output=expected_output, agent=agent)
    crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False)
    result = crew.kickoff()
    return str(result)


def main() -> None:
    load_dotenv()

    gemini_api_key = require_env("GEMINI_API_KEY")
    os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")

    memex_url = os.getenv("MEMEX_URL", "http://localhost:8080").rstrip("/")
    memex_api_key = os.getenv("MEMEX_API_KEY", "dev-agent-key")
    # Today this identifies the agent/user memory namespace in MemexAI; term may change later.
    user_id = os.getenv("MEMEX_USER_ID", DEFAULT_USER_ID)
    crewai_model = os.getenv("CREWAI_MODEL", "gemini/gemini-2.5-flash")
    fact = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_FACT
    recall_query = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_RECALL_QUERY

    check_service(memex_url)

    adapter_probe = MemexAI(url=memex_url, api_key=memex_api_key, timeout=10)
    try:
        adapter_tools = pick_agentic_tools(get_crewai_tools(adapter_probe.for_user(user_id, actor=ACTOR)))
        adapter_tool_names = [getattr(adapter_tool, "name", "") for adapter_tool in adapter_tools]
    finally:
        run_async(adapter_probe.close())

    tools = build_practical_crewai_tools(memex_url, memex_api_key, user_id)
    llm = LLM(model=crewai_model, api_key=gemini_api_key, temperature=0)
    agent = build_agent(tools, llm)

    print(f"MemexAI service: {memex_url}")
    print(f"Memory user id: {user_id}")
    print(f"Adapter agentic tools available: {', '.join(adapter_tool_names)}")
    print("\nTurn 1 - remember")
    remember_output = run_task(
        agent,
        "\n".join(
            [
                f"User said: Remember that {fact}",
                "Use memory_memorize to save this durable preference in MemexAI.",
                "Keep your final answer to one short sentence.",
            ]
        ),
        "A one-sentence confirmation that the preference was saved.",
    )
    print(remember_output)

    # This post-turn memorize call makes the terminal demo deterministic even if
    # the agent replies before choosing a tool. Re-running can create equivalent
    # entries, so production apps should dedupe turn text before post-turn saves.
    post_turn = call_memory(
        memex_url,
        memex_api_key,
        user_id,
        "memorize",
        {
            "text": f"User said: Remember that {fact}",
            "maxWrites": 3,
        },
    )
    print("\nPost-turn memorize writes:")
    print(json.dumps(post_turn.get("writes", []), indent=2, default=str))

    print("\nTurn 2 - recall")
    recall_output = run_task(
        agent,
        "\n".join(
            [
                f"User asked: {recall_query}",
                "Use memory_search before answering. Answer with the remembered preference only.",
            ]
        ),
        "The stored apartment preference, grounded in MemexAI memory.",
    )
    print(recall_output)

    verification = call_memory(
        memex_url,
        memex_api_key,
        user_id,
        "search",
        {"query": "2BHK apartment preference near metro", "maxChars": 4000, "limit": 5},
    )
    files = call_memory(memex_url, memex_api_key, user_id, "list", {"prefix": "user/"})
    print("\nService verification:")
    print(json.dumps({"files": files.get("files", []), "search": verification}, indent=2, default=str))


if __name__ == "__main__":
    main()
