import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


class FakeDb:
    def __init__(self, files=None):
        self.files = {}
        self.revisions = []
        self.access_logs = []
        self.calls = []
        self.next_id = 0
        for path, content in (files or {}).items():
            self.next_id += 1
            now = datetime(2026, 5, 20, 10, 0, tzinfo=timezone.utc)
            self.files[path] = {
                "id": f"file_{self.next_id}",
                "physical_path": path,
                "content_text": content,
                "created_at": now,
                "updated_at": now,
            }

    async def query(self, sql, *values):
        self.calls.append(("query", sql, values))

        if "INSERT INTO mx_file" in sql:
            _, physical_path, content = values
            existing = self.files.get(physical_path)
            now = datetime(2026, 5, 20, 10, 1, tzinfo=timezone.utc)
            if existing:
                existing["content_text"] = content
                existing["updated_at"] = now
                return [{"id": existing["id"], "created": False}]

            self.next_id += 1
            row = {
                "id": f"file_{self.next_id}",
                "physical_path": physical_path,
                "content_text": content,
                "created_at": now,
                "updated_at": now,
            }
            self.files[physical_path] = row
            return [{"id": row["id"], "created": True}]

        if "SELECT id, physical_path, content_text, created_at, updated_at FROM mx_file WHERE physical_path = $1" in sql:
            row = self.files.get(values[0])
            return [dict(row)] if row else []

        if "physical_path = ANY($1)" in sql:
            physical_paths = set(values[0])
            return [dict(row) for row in self.files.values() if row["physical_path"] in physical_paths]

        if "FROM mx_file" in sql and "ORDER BY physical_path ASC" in sql:
            rows = []
            for row in self.files.values():
                if len(values) == 2:
                    exact, prefix = values
                    if row["physical_path"] == exact or row["physical_path"].startswith(prefix.rstrip("%")):
                        rows.append(dict(row))
                else:
                    user_prefix = values[0].rstrip("%")
                    if row["physical_path"] == "shared" or row["physical_path"].startswith("shared/") or row["physical_path"].startswith(user_prefix):
                        rows.append(dict(row))
            return sorted(rows, key=lambda row: row["physical_path"])

        if "FROM mx_file" in sql and "search_vector @@ q.query" in sql:
            user_prefix = values[-1].rstrip("%")
            rows = [
                dict(row)
                for row in self.files.values()
                if "rank" in row and (row["physical_path"].startswith(user_prefix) or row["physical_path"].startswith("shared/"))
            ]
            return sorted(rows, key=lambda row: (-row["rank"], row["updated_at"]))

        if "FROM mx_file" in sql and "ORDER BY updated_at DESC" in sql:
            user_prefix = values[-1].rstrip("%")
            rows = [
                dict(row)
                for row in self.files.values()
                if row["physical_path"].startswith(user_prefix) or row["physical_path"].startswith("shared/")
            ]
            return sorted(rows, key=lambda row: row["updated_at"], reverse=True)

        return []

    async def execute(self, sql, *values):
        self.calls.append(("execute", sql, values))
        if "INSERT INTO mx_revision" in sql:
            self.revisions.append(values)
        elif "INSERT INTO mx_access_log" in sql:
            self.access_logs.append(values)
        elif "UPDATE mx_file SET content_text" in sql:
            content, file_id = values
            for row in self.files.values():
                if row["id"] == file_id:
                    row["content_text"] = content
                    row["updated_at"] = datetime(2026, 5, 20, 10, 2, tzinfo=timezone.utc)
                    break
        return "OK"

    async def close(self):
        self.closed = True
