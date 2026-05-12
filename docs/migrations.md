# Migrations

memexai manages its own schema with a lightweight migration runner. You never need to write SQL to set up the tables — calling `migrate()` handles everything.

---

## How it works

```ts
const memex = createMemex(process.env.DATABASE_URL)
await memex.migrate()  // safe to call on every startup
```

`migrate()` is idempotent. It:

1. Creates `mx_migration` if it doesn't exist (the migration tracking table).
2. Loops through the list of known migrations in order.
3. For each migration, checks if its ID is already in `mx_migration`.
4. If not applied: runs the SQL in a transaction (`BEGIN` / `COMMIT`), then inserts the migration ID.
5. If already applied: skips it.

On first run, this creates all four tables. On subsequent runs, it's a fast no-op — a short `SELECT` per migration ID, all of which return a row.

---

## The migration table

```sql
CREATE TABLE IF NOT EXISTS mx_migration (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Each row records a migration ID (`"001_init.sql"`) and when it was applied. This is all the state the runner needs.

---

## Current schema

**Migration `001_init.sql`** creates:

- `mx_file` — one row per memory file
- `mx_revision` — one row per write, with full content snapshot
- `mx_access_log` — one row per tool call (reads and writes)

See [architecture.md](architecture.md) for what each table stores.

---

## Why migrations are inlined as strings

In an npm package, you can't reliably `readFile` SQL from disk — the package install path varies, bundlers may not include `.sql` files, and serverless environments may have no filesystem at all. Inlining migration SQL as string constants means the package is self-contained. No file I/O, no `__dirname` hacks, no bundler configuration needed.

This is the tradeoff: migrations are a bit harder to read than separate `.sql` files, but they work in every environment where Node.js runs.

---

## When to call migrate()

- **Direct Postgres mode:** Call `migrate()` once on startup before any tool calls. It's safe to call it every time your application starts — the cost is a few fast `SELECT` queries.
- **HTTP service mode:** The service calls `migrate()` automatically on startup. You don't need to do anything.

In serverless environments (Lambda, Vercel), calling `migrate()` on every cold start is fine. The check is fast (one `SELECT` per migration) and the tables already exist after the first run.

---

## Adding a new migration

Add a new entry to the `MIGRATIONS` array in `packages/core/src/migrations.ts`:

```ts
const MIGRATIONS = [
  {
    id: "001_init.sql",
    sql: `...existing schema...`,
  },
  {
    id: "002_add_tags.sql",  // new migration
    sql: `
ALTER TABLE mx_file ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS mx_file_tags_idx ON mx_file USING gin(tags);
    `.trim(),
  },
]
```

Rules:

1. **IDs must be unique and must not change.** The ID is the primary key in `mx_migration`. Once a migration has been applied to any database, its ID is permanent.
2. **IDs should sort in application order.** Use zero-padded numeric prefixes (`001_`, `002_`, ...) to make the order obvious.
3. **SQL must be idempotent.** Use `IF NOT EXISTS`, `IF EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc. This protects against edge cases where the migration ran but the tracker insert failed.
4. **Each migration runs in a transaction.** If any statement fails, the whole migration is rolled back and the ID is not inserted. Fix the SQL and redeploy — it will retry.

---

## Schema compatibility

The `mx_` prefix is chosen to minimize collision with existing application tables. If you have a table that starts with `mx_`, rename it before running migrations — memexai will refuse to create a conflicting table and the migration will fail.

The migration runner never drops or alters existing tables on its own. Adding columns or indexes is safe in new migrations. If you need to remove something, write a migration that drops it explicitly.
