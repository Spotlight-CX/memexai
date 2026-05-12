# Spec: Pre-Write Hooks + PII Redaction

**Priority:** Tier 2 — significant differentiation  
**Status:** Not started

---

## Why

GDPR, CCPA, and HIPAA compliance is the enterprise gate. Healthcare, finance, and government organizations need agents that can't accidentally persist PII into durable storage. No current memory solution — mem0, Zep, Letta — ships built-in PII hooks. This is an unoccupied niche.

The design has two surfaces, one per deployment mode:

1. **Container mode:** Server-side env var configuration — zero SDK changes required for teams already using Docker.
2. **Direct Postgres mode:** Programmatic hook API on the `Memex` instance for developers who build with `@memexai/core` or the Python SDK.

---

## Surface 1: Container Mode (env vars)

No code changes in client applications. Configured at the service level.

**Environment variables:**

```bash
MEMEX_PII_POLICY=redact    # or: block | off (default: off)
MEMEX_PII_PATTERNS=email,phone,ssn,credit_card,ip  # comma-separated
```

**Behavior:**
- `off` (default): no scanning, pass-through
- `redact`: detected PII replaced with `[REDACTED:TYPE]` before SQL write
- `block`: write rejected with `MemexError("WRITE_BLOCKED_PII", ...)` — agent gets an error, must rewrite without PII

**Where it applies:** `apps/service/src/server.ts` — in the `POST /v1/tools/:toolName/execute` handler, before calling `executeTool`. Applies to `memory_write` and `memory_patch` operations only (not list/read).

**What gets logged:** Access log entry includes `pii_detected: ["EMAIL", "PHONE"]` (the types found, not the original content). Never log the original PII.

---

## Surface 2: Direct Postgres Mode (programmatic)

```ts
import { createMemex, createPiiRedactHook } from "@memexai/core"

const memex = createMemex(process.env.DATABASE_URL)
  .addHook("before_write", createPiiRedactHook({ policy: "redact" }))

await memex.migrate()
```

Hooks are chainable and run in order:

```ts
memex
  .addHook("before_write", createPiiRedactHook({ policy: "redact", patterns: ["email", "phone"] }))
  .addHook("before_write", myCustomValidationHook)
```

---

## Hook API

**New file: `packages/core/src/hooks.ts`**

```ts
export type HookFn = (content: string, ctx: ToolContext) => Promise<string> | string

export type HookEvent = "before_write"

export class HookRegistry {
  private hooks: Map<HookEvent, HookFn[]> = new Map()

  add(event: HookEvent, fn: HookFn): this {
    const list = this.hooks.get(event) ?? []
    list.push(fn)
    this.hooks.set(event, list)
    return this
  }

  async run(event: HookEvent, content: string, ctx: ToolContext): Promise<string> {
    const fns = this.hooks.get(event) ?? []
    let result = content
    for (const fn of fns) {
      result = await fn(result, ctx)
    }
    return result
  }
}
```

**Wired into `Memex` class (`packages/core/src/memex.ts`):**

```ts
class Memex {
  private readonly hookRegistry = new HookRegistry()

  addHook(event: HookEvent, fn: HookFn): this {
    this.hookRegistry.add(event, fn)
    return this
  }
}
```

**Wired into tool execution (`packages/core/src/tools.ts`):**

In `memory_write` and `memory_patch` handlers, before the SQL upsert:

```ts
const finalContent = await hookRegistry.run("before_write", content, ctx)
// then write finalContent to mx_file
```

---

## PII Redaction Patterns

**New file: `packages/core/src/pii.ts`**

```ts
export type PiiPattern = "email" | "phone" | "ssn" | "credit_card" | "ip"

export type PiiPolicy = "redact" | "block" | "off"

export interface PiiRedactOptions {
  policy?: PiiPolicy
  patterns?: PiiPattern[]  // default: all
}

export function createPiiRedactHook(options: PiiRedactOptions = {}): HookFn
```

**Regex patterns:**

| Pattern | Regex covers | Replacement |
|---|---|---|
| `email` | Standard email addresses | `[REDACTED:EMAIL]` |
| `phone` | US formats + E.164 (+1...) | `[REDACTED:PHONE]` |
| `ssn` | `XXX-XX-XXXX` | `[REDACTED:SSN]` |
| `credit_card` | 13–19 digit sequences with Luhn check | `[REDACTED:CREDIT_CARD]` |
| `ip` | IPv4 + IPv6 | `[REDACTED:IP]` |

With `policy: "block"`: if any pattern matches, throw `new MemexError("WRITE_BLOCKED_PII", "Write blocked: content contains PII (email, phone)")`. The agent receives this as a tool error and must rewrite.

---

## Optional: Presidio Integration

For teams that need entity-level NLP-based detection (beyond regex):

```ts
import { createPresidioPiiHook } from "@memexai/core/pii-presidio"

memex.addHook("before_write", createPresidioPiiHook({
  presidioUrl: "http://localhost:3000",  // self-hosted Presidio API
  policy: "redact",
}))
```

This is an optional peer dep — not bundled. Presidio is Apache 2.0, runs as a standalone service.
See: https://github.com/microsoft/presidio

The `@memexai/core/pii-presidio` sub-path export is only shipped if Presidio integration is confirmed useful by users. Start with regex; add Presidio if requested.

---

## Python SDK equivalent

```python
from memexai import create_memex
from memexai import create_pii_redact_hook

memex = create_memex(DATABASE_URL)
memex.add_hook("before_write", create_pii_redact_hook(policy="redact"))
```

Same interface, same regex patterns. `HookFn` type: `async def hook(content: str, ctx: ToolContext) -> str`.

---

## Files to Create/Modify

| File | Change |
|---|---|
| `packages/core/src/hooks.ts` | New — HookRegistry, HookFn, HookEvent |
| `packages/core/src/pii.ts` | New — createPiiRedactHook, regex patterns |
| `packages/core/src/memex.ts` | Add `addHook()` method, pass hookRegistry to executeTool |
| `packages/core/src/tools.ts` | Run hooks before SQL write in memory_write + memory_patch |
| `packages/core/src/index.ts` | Export HookRegistry, HookFn, HookEvent, createPiiRedactHook |
| `apps/service/src/server.ts` | Read MEMEX_PII_POLICY + MEMEX_PII_PATTERNS, apply before executeTool |

---

## Verification

1. `bun test packages/core/tests/hooks.test.ts`:
   - Hook receives content, returns modified content
   - Hook throws → write blocked, SQL not called
   - Multiple hooks run in order
2. `bun test packages/core/tests/pii.test.ts`:
   - Email pattern detected and replaced
   - SSN pattern detected and replaced
   - `block` policy throws MemexError with code `WRITE_BLOCKED_PII`
   - `off` policy is a no-op
3. Integration (container mode): set `MEMEX_PII_POLICY=redact`, write content with an email address, verify admin UI shows `[REDACTED:EMAIL]` in revision
