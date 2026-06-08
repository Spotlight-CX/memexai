import asyncio
import os

from dotenv import load_dotenv
from memexai import MemexAI


async def main() -> None:
    load_dotenv()
    memex_url = os.getenv("MEMEX_URL") or f"http://localhost:{os.getenv('MEMEX_PORT', '8080')}"
    memex = MemexAI(url=memex_url, api_key=os.getenv("MEMEX_API_KEY", "dev-agent-key"))
    try:
        memory = memex.for_user(os.getenv("MEMEX_USER_ID", "crewai_background_user"), actor="crewai-background-path")
        print("background_path: after Crew kickoff, extract durable facts from final task output")
        task_output = "Task result: API client learned that exports are limited to 10,000 rows per request."
        result = await memory.remember({"text": f"CrewAI task-output durable fact: {task_output}", "maxWrites": 2})
        print(result.get("writes", []))
    finally:
        await memex.close()


if __name__ == "__main__":
    asyncio.run(main())
