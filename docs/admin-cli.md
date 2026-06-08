# memex-admin CLI Reference

`@memexai/admin` is an agent-friendly CLI for inspecting and managing MemexAI agent memory. Every capability is available as a subcommand with `--json` output for scripting.

## Install / run

```bash
# Ephemeral (no install)
npx @memexai/admin [global options] <command> [subcommand] [options]

# Or from a Docker container (binary included in the runtime image)
docker exec <container> memex-admin [global options] <command> [subcommand] [options]
```

## Connection modes

Two mutually exclusive connection modes:

| Mode | Flag | Env var | Notes |
|---|---|---|---|
| Direct Postgres | `--database-url, -d` | `DATABASE_URL` | Connects directly to your Postgres. Runs migrations on first run. |
| HTTP service proxy | `--service-url, -s` | `MEMEX_SERVICE_URL` | Calls the running MemexAI service HTTP API. Requires `--admin-secret`. |

```bash
# Direct mode (standalone, no service running required)
memex-admin -d postgresql://user:pass@localhost/db users list

# HTTP proxy mode (calls the running service)
memex-admin -s http://localhost:8080 --admin-secret $SECRET users list
```

## Global flags

```
--database-url, -d <url>     Postgres connection URL (or DATABASE_URL)
--service-url, -s <url>      HTTP service URL (or MEMEX_SERVICE_URL)
--admin-secret <secret>      Admin secret (or MEMEX_ADMIN_SECRET)
--user, -u <userId>          Default user ID for user-scoped commands
--json                       Output raw JSON to stdout (default: human table)
--no-color                   Disable ANSI color
--help, -h                   Show help
```

---

## Commands

### `serve` — Start web UI
```bash
memex-admin serve [--port 4040] [--no-open]
```
Starts the local admin React UI and opens it in a browser. Requires `--database-url`.

---

### `users` — User management

```bash
memex-admin users list [--search <q>] [--limit 50]
memex-admin users show <userId>
```

`list` returns all users with file counts and last read/write timestamps.  
`show <userId>` lists all memory files for that user.

---

### `files` — File management

```bash
memex-admin files list [--prefix <path>]
memex-admin files get <path>
memex-admin files write <path> [--content <text>] [--content-file <file>] [--reason <reason>]
```

- `list` — browse all files, optionally filtered by path prefix (e.g. `shared/` or `users/alice/`)
- `get` — prints raw file content to stdout (pipeable). Use `--json` to include metadata.
- `write` — create or overwrite a file. Content can be passed inline, read from a file, or piped via stdin. The `reason` is stored in revision history.

```bash
# Examples
memex-admin -d $DB files list --prefix users/alice/
memex-admin -d $DB files get shared/index.md
echo "# My notes" | memex-admin -d $DB files write users/alice/notes.md --reason "init"
memex-admin -d $DB files write shared/index.md --content-file ./my-index.md --reason "bootstrap"
```

---

### `revisions` — Revision history and time-travel

```bash
memex-admin revisions list [--path <p>] [--user <u>] [--actor <a>] [--from <iso>] [--to <iso>] [--limit 50] [--offset 0]
memex-admin revisions diff <path> [--rev-a <offset>] [--rev-b <offset>]
```

Every write creates a revision row with full content snapshot. `rev-a`/`rev-b` are zero-indexed from newest (0 = latest, 1 = one before, etc).

```bash
# See all writes to a file
memex-admin -d $DB revisions list --path users/alice/notes.md

# Diff: what changed from the previous write to the latest
memex-admin -d $DB revisions diff users/alice/notes.md --rev-a 1 --rev-b 0
```

---

### `logs` — Access log inspection

```bash
memex-admin logs list [--path <p>] [--user <u>] [--tool-call-id <id>] [--from <iso>] [--to <iso>] [--limit 50]
```

Every memory tool call (read, write, search, smart_read) is logged here. Use `--tool-call-id` to correlate with revisions.

---

### `trace` — Memory subagent route tracing

```bash
memex-admin trace <toolCallId>
memex-admin trace session --user <userId> [--from <iso>] [--limit 50]
```

`trace <id>` shows the full picture for one tool call: root observation event, child spans, duration, status, trace ID, files accessed, and revisions written. This is the primary debugging command for understanding what an agent did.

`trace session` lists root tool calls for a user in reverse-chronological order. Use it to find the `toolCallId`, then drill into the span waterfall with `trace <id>`.

```bash
# Find recent tool calls for a user
memex-admin -d $DB --json logs list --user alice --from 1h

# Drill into a specific call
memex-admin -d $DB trace tc_abc123

# Session-level view
memex-admin -d $DB trace session --user alice --limit 20
```

**Example output:**
```
Trace: 9lmLNqFoYL3uIShY
Tool:     memory_remember  |  Status: success  |  Duration: 8592ms
User:     alice  |  Actor: my-agent

Files accessed (5):
CREATEDAT            OPERATION  PHYSICALPATH                ACTOR
───────────────────  ─────────  ──────────────────────────  ────────
2025-06-04 07:51:39  list       *                           my-agent
2025-06-04 07:51:39  read       shared/index.md             my-agent
2025-06-04 07:51:42  write      users/alice/profile.md      my-agent

Revisions written (2):
CREATEDAT            OPERATION  PHYSICALPATH            SIZEBYTES  REASON
───────────────────  ─────────  ──────────────────────  ─────────  ───────────────
2025-06-04 07:51:42  write      users/alice/profile.md  90         Stored preference
2025-06-04 07:51:44  write      users/alice/index.md    81         Updated index
```

---

### `memory` — Memory state and time-travel

```bash
memex-admin memory snapshot --user <userId> [--at <iso>]
memex-admin memory diff <path> [--rev-a <offset>] [--rev-b <offset>]
```

`snapshot` reconstructs the full memory state of a user at a given timestamp — exactly what the agent saw when a request hit. Without `--at`, returns the current state.

`diff` shows a unified diff between two revisions of a specific file.

```bash
# What did alice's memory look like when the bug happened?
memex-admin -d $DB memory snapshot --user alice --at "2025-06-03T14:22:00Z"

# What changed in alice's notes between the last two writes?
memex-admin -d $DB memory diff users/alice/notes.md --rev-a 1 --rev-b 0

# Full content included in JSON output
memex-admin -d $DB --json memory snapshot --user alice --at "2025-06-03T14:22:00Z"
```

---

### `dream` — Dream cycle management

```bash
memex-admin dream status [--user <u>]
memex-admin dream run [--user <u>]        # HTTP mode only
memex-admin dream pause <userId>          # HTTP mode only
memex-admin dream unpause <userId>        # HTTP mode only
```

`status` shows which users have dream runs active/failed/completed. `run`, `pause`, and `unpause` require `--service-url` (HTTP proxy mode).

---

### `setup` — Bootstrap shared memory

```bash
memex-admin setup status
memex-admin setup complete [--note "..."]
```

`status` checks if `shared/` is bootstrapped and shows what files exist.  
`complete` marks setup as done in `mx_config` and records an optional note.

The CLI is the executor — the agent does the reasoning. Typical flow:
```bash
# Agent reads codebase, decides on memory shape, writes shared files
memex-admin -d $DB files write shared/index.md --content "..." --reason "bootstrap"
memex-admin -d $DB files write shared/user-memory.md --content "..." --reason "bootstrap"

# Mark complete
memex-admin -d $DB setup complete --note "real-estate assistant"

# Verify
memex-admin -d $DB setup status
```

After setup, the agent should write a `MEMEX.md` file to the project repo documenting the memory schema and CLI quick-reference. See `SETUP.md` for the full flow.

---

### `observe` — Observability (HTTP mode only)

```bash
memex-admin observe summary [--from <iso>] [--to <iso>] [--user <u>]
memex-admin observe user <userId>
memex-admin observe top-files [--limit 20]
```

Requires `--service-url`. Proxies to the service's observability endpoints.

---

### `api` — Raw HTTP passthrough (HTTP mode only)

```bash
memex-admin api GET|POST|PUT|DELETE <path> [--body '{"key":"val"}']
memex-admin api-spec
```

`api` calls any service endpoint directly. Useful for operations not yet in the named command set.  
`api-spec` prints the OpenAPI JSON spec from the service.

```bash
# Call any admin endpoint
memex-admin -s http://localhost:8080 --admin-secret $SECRET api GET /v1/admin/users
memex-admin -s http://localhost:8080 --admin-secret $SECRET api-spec | python3 -m json.tool | head -30
```

---

## Output modes

| Mode | Flag | Behavior |
|---|---|---|
| Human table | (default) | Auto-sized columns, truncated at 60 chars. Metadata to stderr. |
| JSON | `--json` | Clean JSON to stdout. Nothing else. Pipeable. |
| Raw content | `files get` without `--json` | Raw file content to stdout. |

Errors always go to stderr. Exit codes: 0 = success, 1 = runtime error, 2 = validation/missing arg.

---

## Docker exec pattern

The `memex-admin` binary is included in the MemexAI runtime Docker image:

```bash
# Inspect memory inside the running container
docker exec <container> memex-admin -d $DATABASE_URL --json users list

# Shorthand alias (add to your shell profile)
alias memex-admin='docker exec memexai-service-1 memex-admin'
memex-admin -d $DATABASE_URL trace tc_abc123
```
