# Spec: Agentic Ingestion

**Priority:** Tier 2 — significant differentiation  
**API:** `memex.ingest(text, ctx, options)`  
**Status:** Not started

---

## Why

The current model requires developers to write custom prompts to decide what to extract from a conversation and where to store it. Most developers will skip this and not use memory at all.

`ingest()` lowers the floor: pass raw conversation text (or a user message), let an LLM decide what's worth remembering and where to file it. The LLM uses the actual memory tools — writes are still explicit, still auditable, still go through the hook system (PII redaction applies). This is not a black box like mem0's extraction; it's an agentic tool loop with a visible audit trail.

**Competitive positioning:** mem0's core feature is implicit extraction (their LLM runs in the cloud, you can't audit it). memexai's `ingest()` is explicit extraction — the LLM runs with your key, writes appear in revision history, you can see exactly what was extracted and why.

## Product Stance

Agentic ingestion is the center of MemexAI's approach. MemexAI should not need to store every chat session in memory for later retrieval. The preferred architecture is:

```text
raw session -> ingest durable facts -> write/update memory files -> recall files later
```

Raw transcripts may still be stored by the host app for compliance, replay, debugging, or offline re-ingestion. They are not the primary memory surface.

This makes MemexAI different from systems that primarily optimize:

```text
raw chat corpus -> embeddings/hybrid retrieval -> answer from retrieved chunks
```

That retrieval-first approach is powerful when an arbitrary old detail might matter later. MemexAI's curated approach is stronger when memory should behave like a system of record: compact, editable, auditable, and understandable by humans.

The cost tradeoff is explicit. Agentic ingestion spends model tokens when writing memory, then saves tokens at recall time by keeping only durable records. For high-volume workloads, local or small hosted models should be acceptable for ingestion if the output is structured and conservative. Stronger hosted models can be reserved for spot checks, difficult ingestion domains, or final answer/judge evaluation.

---

## API

```ts
const result = await memex.ingest(text, ctx, {
  model,            // Vercel AI model instance (required)
  maxWrites?: 5,    // cap on tool calls (default: 5)
  dryRun?: false,   // if true, returns planned writes without executing
})

// result:
// {
//   writes: [
//     { tool: "memory_write", path: "user/profile.md", reason: "user prefers 2BHK" },
//     { tool: "memory_patch", path: "user/profile.md", reason: "added budget info" },
//   ],
//   text: "I've noted your preferences."
// }
```

Also available on `MemexUser` for convenience:

```ts
const user = memex.forUser({ userId: "user_123", actor: "assistant" })
await user.ingest("Remember I prefer quiet neighborhoods near good schools", { model })
```

---

## Internal Flow

```
1. List current memory files for this user (memory_list)
   → Shows LLM what already exists so it can patch rather than rewrite

2. Run generateText with:
   - system: "You are a memory extraction agent.
              Given existing memory files and new conversation text,
              decide what durable facts are worth storing.
              Prefer memory_patch over memory_write when a file already exists.
              Use memory_write only for new files.
              Always provide a reason.
              Limit yourself to {maxWrites} write operations."
   - prompt: <text to ingest>
   - tools: { memory_write, memory_patch }  ← read tools excluded (no runaway reads)
   - stopWhen: stepCountIs(maxWrites)

3. All actual writes go through the normal executeTool path
   → Hooks run (PII redaction applies)
   → Revisions created
   → Access logs created

4. Collect tool call results, return summary
```

---

## Why only write tools, no read tools?

Giving the ingest agent access to `memory_read` creates runaway behavior — the model reads, then decides to write, then reads again, loops. Capping to write-only forces a single pass: see the index, decide what to write, write it.

The `memory_list` call at step 1 gives the model enough context (file names and sizes) to decide whether to create vs patch without needing to read file contents.

---

## Dry run mode

```ts
const plan = await user.ingest(text, { model, dryRun: true })
// plan.writes = [{ tool, path, args }] — no SQL runs
// Show this to user for review before committing
```

Useful for building human-in-the-loop confirmation flows.

---

## Implementation

**New file: `packages/core/src/ingest.ts`**

```ts
import { generateText, stepCountIs } from "ai"
import { createVercelAITools } from "./adapters/vercel-ai"
import type { MemexUser } from "./memex"
import type { ToolContext } from "./paths"

export interface IngestOptions {
  model: unknown           // Vercel AI model instance (typed as any to avoid peer dep in type position)
  maxWrites?: number
  dryRun?: boolean
}

export interface IngestResult {
  writes: IngestWrite[]
  text: string
}

export interface IngestWrite {
  tool: string
  path: string
  reason?: string
}

export async function ingest(
  text: string,
  user: MemexUser,
  options: IngestOptions
): Promise<IngestResult>
```

**Wire onto `MemexUser`:**

```ts
class MemexUser {
  async ingest(text: string, options: IngestOptions): Promise<IngestResult> {
    return ingest(text, this, options)
  }
}
```

**Peer dependency:** `ai` (Vercel AI SDK) — already listed in demo-agent. For core package, list as optional peer dep.

---

## Python equivalent

```python
from memexai import create_memex

memex = create_memex(DATABASE_URL)
user = memex.for_user(user_id="user_123", actor="assistant")

result = await user.ingest(
    "Remember I prefer quiet neighborhoods near good schools",
    model=model,  # any supported model
    max_writes=5,
)
print(result.writes)
```

---

## Prompting guidance (for spec)

The extraction prompt matters a lot. Key principles:
- Prefer patch over write (surgical updates keep history clean)
- Only write durable facts, not ephemeral conversation content
- Preserve source anchors when available, such as session IDs, dates, message IDs, or URLs
- Track updates explicitly: current value plus previous value when the change matters
- Prefer structured files such as `user/profile.md`, `user/preferences.md`, `user/timeline.md`, and `user/projects/{name}.md`
- Use the reason field to explain what triggered the write
- Don't write the same fact twice — the memory_list output shows existing files

The default system prompt should be a short, opinionated template. Developers can override via `systemPrompt` option if they want custom extraction behavior.

---

## Files to Create/Modify

| File | Change |
|---|---|
| `packages/core/src/ingest.ts` | New — ingest() function |
| `packages/core/src/memex.ts` | Add user.ingest() convenience method |
| `packages/core/src/index.ts` | Export ingest, IngestOptions, IngestResult |

---

## Verification

1. `bun test packages/core/tests/ingest.test.ts`:
   - Mock `generateText` — returns tool calls for memory_write
   - Verify writes are executed against mock DB
   - Verify hooks fire (PII redaction on ingest output)
   - `dryRun: true` — verify no SQL writes
2. Integration: `bun run demo:agent -- --ingest "I have 2 kids and prefer 3BHK"` — verify memory_write appears in admin UI with correct reason
