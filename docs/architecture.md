# Architecture

memexai has two deployment modes that share the same Postgres schema and admin UI. The difference is where the logic runs — inside an HTTP service container, or directly in your application process.

---

## Mode 1: Container (HTTP service)

```
┌─────────────────────────────────────────────────┐
│  Docker compose                                 │
│                                                 │
│  ┌─────────────┐    ┌──────────────────────┐   │
│  │  Postgres   │◄───│  Memory service      │   │
│  │  port 5433  │    │  (Fastify, port 8080)│   │
│  └─────────────┘    │  + Admin UI          │   │
│                     └──────────────────────┘   │
└─────────────────────────────────────────────────┘
         ▲
         │  HTTP  (API key auth)
         │
┌────────────────────┐
│  Your application  │  uses @memexai/sdk
└────────────────────┘
```

Your application never touches Postgres directly. It calls the memory service over HTTP using an API key. The service handles:

- API key verification
- Path validation and virtual→physical translation
- SQL reads/writes to `mx_file`, `mx_revision`, `mx_access_log`
- Serving the admin UI

**Start:**
```bash
docker compose up -d
# Postgres on 5433, API + admin at http://localhost:8080
```

**Why this is recommended for teams:**
- Application servers don't need database credentials — only the memory service does.
- Multiple services or apps can share one memory namespace without coordination.
- The service is a single deploy target (one URL to configure, one thing to scale).
- Admin UI is always available at `/admin` — no extra step.

---

## Mode 2: Direct Postgres (no container)

```
┌─────────────────────────────────────────────────┐
│  Your application process                       │
│                                                 │
│  @memexai/core  ──►  pg.Pool  ──►  Postgres    │
│                                                 │
└─────────────────────────────────────────────────┘
         ▲
         │  (separate CLI, also direct)
         │
npx @memexai/admin --database-url postgresql://...
```

`@memexai/core` opens a `pg.Pool` inside your process and queries Postgres directly. There is no HTTP layer, no auth, no service to run or deploy. Your application is responsible for calling `migrate()` on startup.

The admin CLI connects to the same Postgres database separately when you need to inspect memory.

**Why you'd pick this:**
- Zero extra services. If you already have Postgres, you have everything.
- Works in serverless environments (Neon, Supabase, PlanetScale Postgres). Poolers like PgBouncer or Neon's serverless driver work fine — just point `DATABASE_URL` at them.
- Simpler to reason about: tool calls are function calls in the same process, not HTTP round trips.
- Great for single-process apps, local development, and hobby projects.

---

## Tool call flow

This is the same in both modes — the difference is whether step 3 crosses an HTTP boundary.

```
1.  AI model generates a tool call
    e.g. { name: "memory_write", input: { path: "user/profile.md", content: "..." } }

2.  Framework adapter intercepts
    Vercel AI SDK, Anthropic SDK, LangChain, or raw JSON Schema

3.  executeTool(name, args, ctx) runs
    ctx = { userId, actor, toolCallId }

4.  Path validation
    "user/profile.md"  →  validated as writable (user/ prefix)
    "shared/index.md"  →  read-only, write blocked

5.  Virtual → physical translation
    "user/profile.md"  →  "users/user_123/profile.md"

6.  SQL writes
    UPSERT  mx_file       (physical_path, content_text)
    INSERT  mx_revision   (file_id, operation, content_text, reason, actor, user_id, tool_call_id)
    INSERT  mx_access_log (file_id, physical_path, operation, actor, user_id, tool_call_id)

7.  Returns result to model
    { path: "user/profile.md", created: true, updated: false }

8.  Model generates next response (or calls another tool)
```

Every step from 3 onward is identical whether you're using the HTTP service or direct Postgres. The adapters just call `executeTool` — they don't know or care which mode is in use.

---

## Database tables

Four tables, all prefixed `mx_` to avoid collisions with your existing schema:

| Table | Purpose |
|---|---|
| `mx_migration` | Tracks which migrations have run (prevents re-application) |
| `mx_file` | One row per memory file: `physical_path`, `content_text`, timestamps |
| `mx_revision` | One row per write: full content snapshot, actor, reason, tool call ID |
| `mx_access_log` | One row per read or write: lightweight operation log |

All tables are created by `migrate()` / `memex.migrate()` on first run. See [migrations.md](migrations.md).

---

## Deploying the HTTP service

The service (`apps/service`) is a Fastify app. You can deploy it anywhere Node.js runs:

```bash
# Build
bun run build:service

# Run with environment variables
DATABASE_URL=postgresql://...
MEMEX_API_KEY=your-api-key           # comma-separated list of valid API keys
MEMEX_ADMIN_SECRET=your-admin-secret  # for admin endpoints (separate from agent keys)
```

The Docker image bundles the compiled service + admin UI static files. The admin UI is served from `/admin/*` and queries the same `/v1/admin/*` API.

For production, you want:
- The service behind a reverse proxy (nginx, Caddy, or a managed load balancer)
- `MEMEX_API_KEY` rotated as needed (the service checks on every request)
- Postgres with standard backup and monitoring

---

## Deploying without the HTTP service

If you're running `@memexai/core` directly in your application, the "deployment" is just your application plus a Postgres database. There's nothing extra to run.

For serverless (Lambda, Vercel Edge, Cloudflare Workers):
- Use Neon or Supabase for Postgres with HTTP-compatible or WebSocket drivers.
- Neon's `@neondatabase/serverless` driver is compatible with `pg.Pool`'s interface.
- Call `migrate()` in your build step or once on first deploy — not on every cold start.

For the admin UI in this mode:
- Run `npx @memexai/admin --database-url postgresql://...` locally, pointing at your production DB.
- The CLI binds to `127.0.0.1` only and requires no auth — it's a local developer tool, not a production service.
