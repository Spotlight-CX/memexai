# Spec: Agentic Recall

**Priority:** Tier 2 — significant differentiation  
**API:** `user.recall(query, options?)`  
**Status:** Not started

---

## Why

`getPromptBlock()` loads everything — it's a blunt instrument designed for the system prompt at conversation start. But as memory grows, you don't always want everything. Sometimes you need targeted retrieval: "What does this user prefer about commute?" or "What's their budget range?"

`recall()` is surgical where `memory_smart_read` is broad:
- `memory_smart_read` → use at conversation start, load all/most memory into system prompt
- `recall()` → use mid-conversation, get the most relevant slice for a specific question

This is mem0's core use case (semantic search), but memexai does it without a vector store — BM25 + optional LLM reranking on top of Postgres.

---

## API

```ts
// Developer-side
const context = await user.recall("What does this user prefer for neighborhoods?", {
  maxChars: 8000,   // default
  model,            // optional: if provided, LLM reranks and summarizes
})
// Returns a formatted string, ready to inject into a prompt

// Agent-side (tool)
// Agent calls: memory_recall({ query: "neighborhood preferences", max_chars: 8000 })
// → same result, returned as tool output
```

---

## Internal Flow

### Without model (fast path)

```
1. memory_smart_read with { query, max_chars: maxChars }
   → BM25 ranks files by query relevance
   → BFS adds files until budget reached, sorted by BM25 rank
2. Return merged context block
```

Single SQL query, no LLM call. Fast.

### With model (reranker pass)

```
1. memory_smart_read with { query, max_chars: maxChars * 2 }
   → Fetch more than needed (double budget)
2. LLM call: "Given this query: '{query}', here is the user's memory.
               Extract only the facts that directly answer the query.
               Return a concise summary. Max {maxChars} characters."
3. Return LLM-distilled string
```

One extra LLM call, much tighter output. Use when precision matters more than latency.

---

## Distinction from `memory_smart_read`

| | `memory_smart_read` | `recall(query)` |
|---|---|---|
| When to use | System prompt assembly (start of conversation) | Mid-conversation targeted lookup |
| Returns | All relevant memory up to budget | Targeted slice for a specific query |
| LLM call | Never | Optional (reranker) |
| Ranking | Recency-first, then BM25 if query provided | BM25-first, then optional reranker |
| Agent-accessible | Yes (tool) | Yes (tool: memory_recall) |

---

## Tool definition

Add to `packages/core/src/tool-definitions.ts`:

```ts
{
  name: "memory_recall",
  description: "Retrieve the most relevant memory for a specific question. Cheaper than memory_smart_read for mid-conversation lookups. Use when you need to answer a specific question about this user without loading all their memory.",
  inputSchema: {
    type: "object",
    required: ["query"],
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "The question or topic to retrieve memory for." },
      max_chars: { type: "number", description: "Max characters to return. Default: 8000." }
    }
  }
}
```

The tool version does not use the LLM reranker (no model available at tool execution time). It uses BM25 only — still much better than prefix listing.

---

## Depends on

- Spec 02 (smart context): `memory_smart_read` tool with `query` parameter for BM25 ranking. `recall()` calls this internally.

---

## Implementation

**New file: `packages/core/src/recall.ts`**

```ts
import { generateText } from "ai"
import type { MemexUser } from "./memex"

export interface RecallOptions {
  maxChars?: number   // default 8000
  model?: unknown     // if provided, reranker pass runs
}

export async function recall(
  query: string,
  user: MemexUser,
  options: RecallOptions = {}
): Promise<string>
```

**Wire onto `MemexUser`:**

```ts
class MemexUser {
  async recall(query: string, options?: RecallOptions): Promise<string> {
    return recall(query, this, options)
  }
}
```

---

## Python equivalent

```python
context = await user.recall(
    "What does this user prefer for neighborhoods?",
    max_chars=8000,
    model=model,  # optional
)
```

---

## Files to Create/Modify

| File | Change |
|---|---|
| `packages/core/src/recall.ts` | New — recall() function |
| `packages/core/src/memex.ts` | Add user.recall() convenience method |
| `packages/core/src/tool-definitions.ts` | Add memory_recall tool |
| `packages/core/src/tools.ts` | Implement memory_recall handler (no model — BM25 only) |
| `packages/core/src/index.ts` | Export recall, RecallOptions |

---

## Verification

1. `bun test packages/core/tests/recall.test.ts`:
   - Without model: mock smart_read, verify context block returned
   - With model: mock smart_read + generateText, verify reranker prompt contains query
   - Memory_recall tool: verify correct BM25 query, correct output format
2. Integration: agent mid-conversation calls `memory_recall({ query: "neighborhood" })`, verify it returns only neighborhood-related content, not entire profile
