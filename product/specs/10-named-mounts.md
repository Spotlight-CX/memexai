# Spec: Configurable Named Mounts

> Status: Deferred — build when a paying customer needs it. Workaround exists.
> Design session: 2026-05-27

---

## Problem

memexai has two hard-coded memory scopes: `user/` (per-user, private, read-write) and
`shared/` (global, read-only). This breaks when the isolation unit is not an individual
user.

Canonical use case: a team itinerary planner needs memory scoped to the team — shared
itinerary, budget, and constraints — not to a specific member. Workaround today: pass
`teamId` as `userId`. This works but:

1. Prevents simultaneous user + team memory in one agent call.
2. Creates semantic confusion: `user/itinerary.md` reads as personal but is team-shared.
3. Doesn't scale to org, workspace, session, or tenant isolation.

---

## Decision: Why not now

- No paying customer has asked for this yet.
- The workaround (teamId-as-userId) is sufficient for single-scope agents.
- Target market is B2C individual-user products (career coaches, finance assistants)
  — team scoping is a different market segment.
- Cost of deferral is near zero: `mx_file` already stores arbitrary physical prefixes.
  Named mounts can be added in one week, non-breaking, whenever the pull is real.

Build this when a B2B team-tool customer explicitly requests it.

---

## Design

### Named mounts (chosen over `/scoped` primitive)

Keep `user/` and `shared/` unchanged. Let developers register additional mounts at
init time with explicit names and IDs. The mount name carries the semantic meaning —
`team/itinerary.md` is instantly readable; `scoped/itinerary.md` is not.

```typescript
// Direct-postgres mode
const memex = createMemex(DATABASE_URL, {
  mounts: {
    team: { physicalPrefix: 'teams', id: teamId }
  }
})

// Agent gets three simultaneous scopes:
// user/prefs.md      → users/{userId}/prefs.md
// team/itinerary.md  → teams/{teamId}/itinerary.md
// shared/index.md    → shared/index.md

// HTTP service mode (SDK)
const memex = new MemexAI({
  url: '...',
  apiKey: '...',
  userId,
  mounts: {
    team: { physicalPrefix: 'teams', id: teamId }
  }
})
```

### Core wiring

**`packages/core/src/paths.ts`** — extend `ToolContext`, update path functions:

```typescript
export type MountConfig = Record<string, { physicalPrefix: string; id: string; description?: string }>

export type ToolContext = {
  userId: string
  mounts?: MountConfig
  actor?: string
  toolCallId?: string
}
```

`virtualToPhysical` checks developer mounts after `user/` and `shared/`:

```typescript
if (ctx.mounts) {
  for (const [mountName, config] of Object.entries(ctx.mounts)) {
    if (path === mountName || path.startsWith(`${mountName}/`)) {
      const rest = path === mountName ? "" : `/${path.slice(`${mountName}/`.length)}`
      return `${config.physicalPrefix}/${config.id}${rest}`
    }
  }
}
throw new MemexError("UNKNOWN_MOUNT", `Path must start with user/, shared/, or a configured mount: ${path}`)
```

**`packages/core/src/memex.ts`** — store mounts on `Memex`, inject via `forUser()`:

```typescript
export class Memex {
  constructor(
    private readonly db: Db,
    private readonly model?: unknown,
    private readonly mounts?: MountConfig,
  ) {}

  forUser(ctx: ToolContext): MemexUser {
    return new MemexUser(this, { ...ctx, mounts: this.mounts ?? ctx.mounts })
  }
}

export function createMemex(
  input: string | { databaseUrl: string; model?: unknown; mounts?: MountConfig }
): Memex {
  const databaseUrl = typeof input === "string" ? input : input.databaseUrl
  const model = typeof input === "string" ? undefined : input.model
  const mounts = typeof input === "string" ? undefined : input.mounts
  if (mounts) validateMountConfig(mounts)
  return new Memex(createPool(databaseUrl), model, mounts)
}
```

`MemexUser.executeTool` already spreads `this.ctx` into every call — no other changes
needed once `forUser` injects mounts.

### Security validation

```typescript
const RESERVED_MOUNTS = new Set(['user', 'shared', 'users'])

export function validateMountConfig(mounts: MountConfig, allowed?: string[]): void {
  for (const [name, config] of Object.entries(mounts)) {
    if (RESERVED_MOUNTS.has(name))
      throw new MemexError("RESERVED_MOUNT", `Mount name '${name}' is reserved`)

    const prefix = config.physicalPrefix
    if (prefix === 'users' || prefix.startsWith('users/') ||
        prefix === 'shared' || prefix.startsWith('shared/'))
      throw new MemexError("RESERVED_PREFIX", `Physical prefix '${prefix}' is reserved`)

    if (config.id.includes('..') || config.id.includes('/'))
      throw new MemexError("INVALID_MOUNT_ID", "Mount ID cannot contain '..' or '/'")

    if (prefix.includes('..') || prefix.includes('/'))
      throw new MemexError("INVALID_MOUNT_PREFIX", "physicalPrefix cannot contain '..' or '/'")

    if (allowed && allowed.length > 0 && !allowed.includes(prefix))
      throw new MemexError("MOUNT_PREFIX_NOT_ALLOWED",
        `physicalPrefix '${prefix}' is not in the allowed list`)
  }
}
```

### Allowed-prefixes control (all modes)

Optional allowlist of permitted physical prefixes, enforced at the layer where it's
configured:

```typescript
// Library or SDK: developer-configured
createMemex(DATABASE_URL, { mounts: { team: ... }, allowedPrefixes: ['teams', 'orgs'] })
```

```
# Service/container: operator-configured env var
MEMEX_ALLOWED_PREFIXES=teams,orgs,workspaces
```

Precedence (service mode): env var governs if set; SDK's `allowedPrefixes` is
secondary. Intersection if both are set.

### Prompt block: surface mounts to the model

Both `packages/core/src/prompt-block.ts` and `apps/service/src/prompt-block.ts`
must inject `<available_mounts>` when mounts are present in `ToolContext`:

```xml
<available_mounts>
  <mount name="team" description="teams scope, id: {teamId}" />
</available_mounts>
```

Without this the model never uses configured mount paths — the tools work but the
agent ignores them.

### `/v1/prompt-block` endpoint

Current GET form (`?userId=...`) can't carry `MountConfig`. Add a POST variant:
`POST /v1/prompt-block` body `{ userId, mounts }`. GET form stays for backward
compatibility (no mounts block injected).

### Trust boundary (HTTP service mode)

In HTTP service mode, `mounts` is caller-supplied per-request. `validateMountConfig`
guards against reserved prefixes and path traversal but does NOT verify that the
caller is authorized to access a given `id`.

Safe for single-tenant deployments. For multi-tenant deployments: the hosting app
must verify the mount IDs belong to the authenticated caller before calling
`/v1/tools/execute`. Document this in the README Security section.

---

## Files to change

| File | Change |
|---|---|
| `packages/core/src/paths.ts` | ToolContext, virtualToPhysical, physicalToVirtual, assertWritableVirtualPath, validateMountConfig (export) |
| `packages/core/src/memex.ts` | Memex class (store mounts, inject in forUser), createMemex factory |
| `packages/core/src/prompt-block.ts` | Inject `<available_mounts>` |
| `apps/service/src/prompt-block.ts` | Same (second independent copy) |
| `apps/service/src/routes.ts` | Zod schema for mounts in execute + prompt-block POST, MEMEX_ALLOWED_PREFIXES check |
| `packages/sdk/src/types.ts` | MemexAIOptions: add `mounts?`, `allowedPrefixes?` |
| `packages/core/tests/paths.test.ts` | Mount resolution, conflict detection, physicalToVirtual round-trip, prefix guard |
| `docs/scopes.md` | Document named mounts pattern |
| `README.md` | Mounts usage example + Security trust boundary note |

No database migration required — `mx_file` already stores arbitrary physical prefixes.

---

## Open questions

1. **HTTP service mount config:** Per-request (current design) vs service-startup env vars — validate with first HTTP-mode customer.
2. **Read-only mounts:** Add `writable: boolean` to MountConfig for injecting team context read-only? Defer until use case exists.
3. **Dream agent + mounts:** Dream consolidation doesn't traverse configured mount paths. Document the pattern; don't code it yet.
