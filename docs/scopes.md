# Memory Scopes

memexai uses a two-level path namespace. Every path an agent sees is a *virtual path*. The system translates it to a *physical path* in the database before any SQL runs.

---

## The two scopes

### `user/` — private to a user

Virtual paths starting with `user/` belong to the user whose `userId` is in the tool context. Agents can read and write here freely.

```
user/profile.md
user/notes/session-2024-01.md
user/reminders.md
```

These are the paths you put in your agent's system prompt and tool calls. The agent never sees the physical location.

### `shared/` — read-only, cross-user

Virtual paths starting with `shared/` are visible to every user but cannot be written by agents. Only an admin (or a direct SQL write) can update shared files.

```
shared/index.md
shared/property-guidelines.md
shared/faq.md
```

Use shared files for context your agents should always have access to regardless of who's asking — system knowledge, policies, reference documents.

---

## Implicit path translation

When an agent writes `user/profile.md` with `userId: "user_123"`, the system translates it:

```
user/profile.md  →  users/user_123/profile.md
```

The translation is implicit — the agent never specifies `userId` in the path itself. The `userId` comes from the tool context set when you call `memex.forUser({ userId, actor })`.

The full mapping rules:

| Virtual path | Physical path (in DB) |
|---|---|
| `user/profile.md` | `users/{userId}/profile.md` |
| `user/notes/session.md` | `users/{userId}/notes/session.md` |
| `user` (directory prefix) | `users/{userId}` |
| `shared/index.md` | `shared/index.md` (no translation) |

**Why implicit translation?** If agents specified `userId` directly in paths, they could accidentally (or intentionally) write to another user's memory by guessing an ID. The translation layer makes user isolation a property of the context, not of the prompt. A model cannot escape its `userId` no matter what path string it generates.

The system also blocks:
- Physical paths (`users/someone/...`) — `PHYSICAL_PATH_FORBIDDEN`
- Paths with `..` or `//` — `INVALID_PATH`
- Writes to `shared/` — `READ_ONLY_MOUNT`

---

## What `memory_list` returns

`memory_list` returns virtual paths for both scopes:

```json
{
  "files": [
    { "path": "user/profile.md", "size": 420, "updatedAt": "2024-01-15T..." },
    { "path": "shared/index.md", "size": 1200, "updatedAt": "2024-01-10T..." }
  ]
}
```

The physical paths (`users/user_123/profile.md`) are never exposed. The agent always works in the virtual namespace.

Filter by scope using the optional `prefix` argument:

```ts
// Only user files
await user.list("user/")

// Only shared files
await user.list("shared/")

// Everything visible to this user (default)
await user.list()
```

---

## Writing to shared/ (admin only)

Shared files are intended for content that the application owner controls. You can write them:

- Through the admin UI
- Via `memex.executeTool("memory_write", { path: "shared/index.md", ... }, ctx)` called directly with admin context (not via an agent)
- Direct SQL in `mx_file`

There is no separate "admin write" tool — the restriction is enforced by checking the virtual path in `assertWritableVirtualPath()`. Any call from agent context that tries to write `shared/` gets `READ_ONLY_MOUNT`.

---

## Designing your memory layout

A few patterns that work well:

**One profile file per user:**
```
user/profile.md       ← stable preferences, durable facts
user/session.md       ← current conversation context (overwritten each session)
user/history/2024-01.md  ← archived session summaries
```

**Shared reference documents:**
```
shared/city-guide.md        ← facts about the city the app covers
shared/property-policies.md ← rules agents should always know
```

**Flat is usually fine.** The path structure is for agent navigation, not database performance. A single `user/memory.md` with headings works as well as a deep directory tree for most use cases. Use directories only when the agent needs to list a subset of files (e.g. `user/sessions/`) without loading everything.

**Prefer `memory_patch` over rewriting.** If an agent learns something new about a user, appending a line under the right heading in `user/profile.md` is cheaper (and leaves a cleaner revision trail) than overwriting the whole file. See the `memory_patch` tool in [architecture.md](architecture.md) for the operations it supports.
