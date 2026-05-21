import pytest

from memexai._migrations import MIGRATIONS, run_migrations


class FakeConnection:
    def __init__(self, db):
        self.db = db

    def transaction(self):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, sql, *values):
        self.db.executed.append((sql, values))
        if sql.startswith("INSERT INTO mx_migration"):
            self.db.applied.add(values[0])
        return "OK"


class FakeAcquire:
    def __init__(self, db):
        self.conn = FakeConnection(db)

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeMigrationDb:
    def __init__(self):
        self.applied = set()
        self.executed = []

    async def execute(self, sql, *values):
        self.executed.append((sql, values))
        return "OK"

    async def query(self, sql, *values):
        return [{"id": values[0]}] if values and values[0] in self.applied else []

    def acquire(self):
        return FakeAcquire(self)


@pytest.mark.asyncio
async def test_run_migrations_applies_each_migration_once():
    db = FakeMigrationDb()

    await run_migrations(db)
    assert db.applied == {migration["id"] for migration in MIGRATIONS}
    first_execute_count = len(db.executed)

    await run_migrations(db)
    assert len(db.executed) == first_execute_count + 1
