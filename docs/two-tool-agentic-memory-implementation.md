# Two-Tool Agentic Memory Implementation Tracker

## Workflow

Each task is implemented independently, validated with its relevant test slice, then committed before moving to the next task. Status values:

- `pending`
- `in_progress`
- `validated`
- `committed`

## Task 1: Shared Tool Definitions And Schemas

Status: `committed`

Scope:
- Add `memory_memorize`, `memory_search`, and `memory_smart_read` tool definitions.
- Keep `memory_list`, `memory_read`, `memory_write`, and `memory_patch`.
- Export `agenticToolDefinitions`, `rawToolDefinitions`, and full `toolDefinitions`.
- Add runtime schemas for memorize, search, and smart read.

Validation:
- `bun test packages/core/tests/schemas.test.ts packages/core/tests/memex.test.ts packages/sdk/tests/adapters.test.ts`

Commit:
- Included in commit for Task 1.

## Task 2: Search Migration

Status: `committed`

Scope:
- Add inline migration `002_search_vector.sql`.
- Add generated stored `search_vector` column.
- Add GIN index.
- Keep migration idempotent.

Validation:
- `bun test packages/core/tests/migrations.test.ts`
- If needed, service migration/config tests.

Commit:
- Included in commit for Task 2.

## Task 3: Smart Read Core Logic

Status: `committed`

Scope:
- Implement `memory_smart_read`.
- Fetch visible user/shared files in one query.
- Return merged content with virtual paths only.
- Apply recency ranking without query and BM25 ranking with query.

Validation:
- `bun test packages/core/tests/smart-context.test.ts`
- Service route test through `/v1/tools/memory_smart_read/execute`.

Commit:
- Included in commit for Task 3.

## Task 4: BM25 `memory_search`

Status: `pending`

Scope:
- Implement deterministic BM25 search.
- Search current user and shared memory by default.
- Support `prefix`, `limit`, and `maxChars`.
- Return virtual paths, snippets, ranks, and updated timestamps.

Validation:
- `bun test packages/core/tests/search.test.ts`
- SDK fallback tests for `memory.search()`.

Commit:
- Pending

## Task 5: Model Config Container

Status: `pending`

Scope:
- Support `createMemex({ databaseUrl, model? })` for direct mode.
- Add service env model factory for Gemini/OpenAI.
- Keep HTTP SDK constructor model-free.
- Add `MODEL_NOT_CONFIGURED`.

Validation:
- `bun test packages/core/tests/memex.test.ts apps/service/tests/config.test.ts packages/sdk/tests/client.test.ts`

Commit:
- Pending

## Task 6: Agentic `memory_search` Resolution

Status: `pending`

Scope:
- Use BM25 fallback without model.
- Use read-only resolver with configured model.
- Build navigation context from list, index files, and BM25 candidates.
- Enforce `maxReads`, `maxChars`, and virtual path boundaries.
- Never write during search.

Validation:
- `bun test packages/core/tests/agentic-search.test.ts`
- Relevant SDK/service tests.

Commit:
- Pending

## Task 7: Agentic `memory_memorize`

Status: `pending`

Scope:
- Add `user.memorize(text, opts)`.
- Require configured model.
- Give inner model write/patch tools only.
- Support `maxWrites` and `dryRun`.
- Route committed writes through existing write/patch handlers.

Validation:
- `bun test packages/core/tests/memorize.test.ts`
- SDK and service route tests for `memory_memorize`.

Commit:
- Pending

## Task 8: Scoped Toolset Builders

Status: `pending`

Scope:
- Add `createAgenticToolset()` and `createRawToolset()` to `MemexUser` and `MemexMemory`.
- Agentic toolset exposes `memory_memorize` and `memory_search`.
- Raw toolset exposes CRUD and smart-read tools.
- Keep standalone Vercel adapter compatible.

Validation:
- `bun test packages/core/tests/adapters.test.ts packages/sdk/tests/adapters.test.ts apps/demo-agent/tests/index.test.ts`

Commit:
- Pending

## Task 9: Service Core Delegation

Status: `pending`

Scope:
- Add service dependency on `@memexai/core`.
- Reuse core definitions and tool execution where practical.
- Preserve existing route contracts and admin behavior.
- Map `MemexError` into HTTP errors.

Validation:
- `bun test apps/service/tests/auth-routes.test.ts apps/service/tests/admin-routes.test.ts`
- New service tool execution tests.

Commit:
- Pending

## Task 10: Prompt Block And Docs

Status: `pending`

Scope:
- Update prompt block to recommend the simplified surface.
- Update README, SDK README, and demos.
- Keep raw file APIs documented for explicit control.

Validation:
- `bun run build`
- Demo agent tests.

Commit:
- Pending

## Final Verification

Status: `pending`

Validation:
- `bun test`
- `bun run build`
- Manual smoke tests for HTTP fallback, container model memorize, direct model toolset, and raw toolset.
