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
- Add `memory_remember`, `memory_context`, and `memory_find` tool definitions.
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
- Implement `memory_find`.
- Fetch visible user/shared files in one query.
- Return merged content with virtual paths only.
- Apply recency ranking without query and BM25 ranking with query.

Validation:
- `bun test packages/core/tests/smart-context.test.ts`
- Service route test through `/v1/tools/memory_find/execute`.

Commit:
- Included in commit for Task 3.

## Task 4: BM25 `memory_context`

Status: `committed`

Scope:
- Implement deterministic BM25 search.
- Search current user and shared memory by default.
- Support `prefix` and `limit`.
- Return virtual paths, snippets, ranks, and updated timestamps.

Validation:
- `bun test packages/core/tests/search.test.ts`
- SDK fallback tests for `memory.find()`.

Commit:
- Included in commit for Task 4.

## Task 5: Model Config Container

Status: `committed`

Scope:
- Support `createMemex({ databaseUrl, model? })` for direct mode.
- Add service env model factory for Gemini/OpenAI.
- Keep HTTP SDK constructor model-free.
- Add `MODEL_NOT_CONFIGURED`.

Validation:
- `bun test packages/core/tests/memex.test.ts apps/service/tests/config.test.ts packages/sdk/tests/client.test.ts`

Commit:
- Included in commit for Task 5.

## Task 6: Agentic `memory_context` Resolution

Status: `committed`

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
- Included in commit for Task 6.

## Task 7: Agentic `memory_remember`

Status: `committed`

Scope:
- Add `user.remember(text, opts)`.
- Require configured model.
- Give inner model write/patch tools only.
- Support `maxWrites` and `dryRun`.
- Route committed writes through existing write/patch handlers.

Validation:
- `bun test packages/core/tests/memorize.test.ts`
- SDK and service route tests for `memory_remember`.

Commit:
- Included in commit for Task 7.

## Task 8: Scoped Toolset Builders

Status: `committed`

Scope:
- Add `createMemorySubagentToolset()` and `createRawToolset()` to `MemexUser` and `MemexMemory`.
- Memory subagentet exposes `memory_remember` and `memory_context`.
- Raw file toolset exposes CRUD and smart-read tools.
- Keep standalone Vercel adapter compatible.

Validation:
- `bun test packages/core/tests/adapters.test.ts packages/sdk/tests/adapters.test.ts apps/demo-agent/tests/index.test.ts`

Commit:
- Included in commit for Task 8.

## Task 9: Service Core Delegation

Status: `committed`

Scope:
- Add service dependency on `@memexai/core`.
- Reuse core definitions and tool execution where practical.
- Preserve existing route contracts and admin behavior.
- Map `MemexError` into HTTP errors.

Validation:
- `bun test apps/service/tests/auth-routes.test.ts apps/service/tests/admin-routes.test.ts`
- New service tool execution tests.

Commit:
- Included in commit for Task 9.

## Task 10: Prompt Block And Docs

Status: `committed`

Scope:
- Update prompt block to recommend the simplified surface.
- Update README, SDK README, and demos.
- Keep raw file APIs documented for explicit control.

Validation:
- `bun run build`
- Demo agent tests.

Commit:
- Included in commit for Task 10.

## Final Verification

Status: `committed`

Validation:
- `bun test`
- `bun run build`
- Manual smoke tests for HTTP fallback, container model memorize, direct model toolset, and raw file toolset.

Result:
- `bun test` passed: 123 tests.
- `bun run build` passed.
