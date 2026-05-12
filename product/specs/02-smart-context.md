# Spec: Smart Context Assembler

**Priority:** Tier 1 — blocking launch  
**Tool name:** `memory_smart_read`  
**Status:** Not started

---

## Why

The current `getPromptBlock` always loads the same three hardcoded files (`shared/index.md`, `shared/claude.md`, `user/index.md`). Agents that need broader context have to manually `memory_list` → decide → `memory_read` → `memory_read` → `memory_read`. This is:

- **Slow:** multiple round-trip tool calls
- **Token-expensive:** each tool call exchange costs input + output tokens
- **Error-prone:** agents may miss files or hallucinate paths

**The insight:** For most users, all memory files combined are still small enough to fit in context in a single read. Merge everything. Measure first. Only get smart when it's too big.

---

## Algorithm

```
memory_smart_read({ max_chars, query? })

1. List all user files + their sizes from mx_file
   (sizes come free — content_text is stored, we can count chars without a separate query)

2. Estimate total chars:
   - Sum content_text length for all files matching user's scope

3. Case A — fits in budget (total ≤ max_chars):
   - Read all files, merge into single context block
   - Return: { content: "<merged>", files_included: [...], files_omitted: [], truncated: false }

4. Case B — over budget:
   - Sort files by updated_at DESC (most recently changed = most relevant)
   - BFS add files until budget reached:
     for file in sorted_files:
       if running_chars + file.char_count ≤ max_chars:
         include it
       else:
         mark as omitted
   - Return: { content: "<merged>", files_included: [...], files_omitted: [...names], truncated: true }

5. Future (if query provided):
   - Run BM25 search first (see below)
   - Rank files by BM25 score descending
   - BFS by rank instead of by updated_at
```

**Single SQL query** — the implementation should fetch `physical_path`, `content_text`, `updated_at` in one query, sorted, with `WHERE physical_path LIKE 'users/{userId}/%' OR physical_path LIKE 'shared/%'`. No N+1 reads.

---

## Returned context block format

```
<memexai_memory>
## user/profile.md
(updated 2026-05-10)

# Profile

- Prefers quiet neighborhoods
- Budget: 2 Cr

## user/notes.md
(updated 2026-05-08)

...

---
Note: 2 file(s) omitted (budget limit). Use memory_search to find specific content.
</memexai_memory>
```

---

## Tool definition

Add to `packages/core/src/tool-definitions.ts`:

```ts
{
  name: "memory_smart_read",
  description: "Read all (or the most relevant) memory files in a single call, merged into one context block. Cheaper than multiple memory_read calls. Use this instead of memory_list + memory_read loops.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      max_chars: {
        type: "number",
        description: "Maximum total characters to return. Default: 24000 (~6K tokens)."
      },
      query: {
        type: "string",
        description: "Optional. If provided, ranks files by BM25 relevance to this query before applying the budget."
      }
    }
  }
}
```

---

## BM25 search (supporting tool)

In parallel with smart_read, also add a dedicated `memory_search` tool for agents that need to find a specific file by content keyword.

**Migration (`002_search_vector.sql`):**
```sql
ALTER TABLE mx_file ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content_text)) STORED;

CREATE INDEX IF NOT EXISTS mx_file_search_idx ON mx_file USING gin(search_vector);
```

Using a `GENERATED ALWAYS AS ... STORED` column means no trigger needed — Postgres updates it automatically on every write. Cleaner than a trigger.

**`memory_search` tool:**
```ts
{
  name: "memory_search",
  description: "Search memory files by keyword. Returns matching file paths and text snippets ranked by relevance. Use when you know a specific term to look for.",
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string" },
      prefix: { type: "string", description: "Optional: filter to user/ or shared/" },
      limit: { type: "number", description: "Max results. Default: 10" }
    }
  }
}
```

SQL: `WHERE search_vector @@ plainto_tsquery('english', $1) ORDER BY ts_rank_cd(search_vector, query) DESC LIMIT $2`

Returns: `{ results: [{ path, snippet, rank }] }` — snippet is a `ts_headline()` extract.

---

## Impact on `getPromptBlock`

`getPromptBlock` should be updated to call `memory_smart_read` logic internally with a generous `max_chars` (e.g. 32K). This replaces the current hardcoded three-file approach and makes the context block reflect all user memory automatically.

The current hardcoded files (`shared/index.md`, `shared/claude.md`, `user/index.md`) are superseded — any file in the user's scope is now included up to budget.

---

## Files to modify

| File | Change |
|---|---|
| `packages/core/src/migrations.ts` | Add `002_search_vector.sql` |
| `packages/core/src/tool-definitions.ts` | Add `memory_smart_read`, `memory_search` |
| `packages/core/src/tools.ts` | Implement both tool handlers |
| `packages/core/src/prompt-block.ts` | Rewrite to use smart_read logic |
| `packages/core/src/index.ts` | No change needed (tools auto-included) |
| `apps/service/src/server.ts` | No change (dynamic tool routing already works) |

---

## Verification

1. Unit test — budget under threshold: create 3 small files, smart_read returns all 3 merged
2. Unit test — budget exceeded: create files summing to > max_chars, smart_read returns subset sorted by recency, includes `files_omitted` list
3. Unit test — search: mock tsvector query, verify ranked results with snippet
4. Integration: run demo agent with 10 memory files, verify single `memory_smart_read` call instead of list+read loop
5. Run `bun test packages/core/tests/smart-context.test.ts`
