import asyncpg
from typing import List, Dict, Any

class DbPool:
    def __init__(self, pool: asyncpg.Pool):
        self._pool = pool

    async def query(self, sql: str, *args) -> List[Dict[str, Any]]:
        # asyncpg fetch returns Record objects. Convert them to dict.
        records = await self._pool.fetch(sql, *args)
        return [dict(r) for r in records]

    async def execute(self, sql: str, *args) -> str:
        return await self._pool.execute(sql, *args)

    def acquire(self):
        return self._pool.acquire()

    async def close(self) -> None:
        await self._pool.close()

async def create_pool(database_url: str) -> DbPool:
    pool = await asyncpg.create_pool(dsn=database_url)
    if pool is None:
        raise RuntimeError("Failed to create connection pool")
    return DbPool(pool)
