import os

import pytest

from memexai import create_memex


@pytest.mark.asyncio
async def test_direct_postgres_write_read_round_trip_when_configured():
    database_url = os.getenv("MEMEXAI_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("Set MEMEXAI_TEST_DATABASE_URL to run Postgres integration tests")

    memex = await create_memex(database_url)
    try:
        await memex.migrate()
        user = memex.for_user("pytest_user", actor="pytest")
        await user.write_file("user/pytest.md", "# Pytest\n- integration", reason="integration test")
        result = await user.read_file("user/pytest.md")
        assert "integration" in result["content"]
    finally:
        await memex.close()
