# Vercel AI SDK Service Example Research

Date: 2026-06-04

## Docs Read

- Vercel AI SDK overview: https://vercel.com/docs/ai-sdk
  - Last updated January 3, 2026.
  - Confirms `generateText` from `ai` and built-in tool calling with `tool`/schemas.
- AI SDK `generateText` reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
  - `generateText` is the right non-interactive API for CLI automation and agents.
  - `stopWhen` defaults to `stepCountIs(1)`; multi-step tool loops need a larger stop condition when the model should answer after tool results.
- AI SDK tool calling guide: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
  - Tools define `description`, `inputSchema`, and optional `execute`.
  - `stopWhen` enables repeated model calls after tool execution until no more tools are called or the condition is met.
- AI SDK `stepCountIs` reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/step-count-is
  - `stepCountIs(n)` is the documented loop limit helper for tool-calling examples.
- Google Generative AI provider docs: https://vercel-ai.mintlify.app/providers/ai-sdk-providers/google-generative-ai
  - Use `@ai-sdk/google` with `createGoogleGenerativeAI({ apiKey })` or `google(...)`.
  - The provider defaults to `GOOGLE_GENERATIVE_AI_API_KEY`, but this example intentionally reads `GEMINI_API_KEY` and passes it explicitly.
- Existing MemexAI docs/examples:
  - `apps/website/content/docs/adapters/vercel-ai.mdx`
  - `packages/sdk/README.md`
  - `packages/sdk/src/client.ts`
  - `packages/sdk/src/adapters/vercel-ai.ts`
  - `examples/vercel-ai/src/index.ts`

## Package Versions

Latest published versions observed on 2026-06-04:

- `ai`: latest `6.0.196`; latest compatible 5.x is `5.0.195`.
- `@ai-sdk/google`: latest `3.0.80`; latest compatible with AI SDK 5 provider packages is `2.0.74`.
- `typescript`: latest `6.0.3`; repo uses `^5.9.3`.
- `dotenv`: latest `17.4.2`.
- `@memexai/sdk`: local package version `0.1.5`, peer dependency `ai: ^5.0.0`.

Chosen example versions:

- `ai: ^5.0.195`
- `@ai-sdk/google: ^2.0.74`
- `@memexai/sdk: file:../../packages/sdk`
- `typescript: ^5.9.3`
- `tsx: ^4.21.0`
- `dotenv: ^17.4.2`

Rationale: AI SDK 6 is newest, but `@memexai/sdk@0.1.5` currently peers against AI SDK 5 and its tool definitions import `jsonSchema` from `ai`. Using the latest 5.x line keeps the example compatible with the SDK in this repository.

## Integration Rationale

- Service mode uses `new MemexAI({ url, apiKey })` from `@memexai/sdk`; it never imports `@memexai/core`, `pg`, or `DATABASE_URL`.
- `memex.forUser({ userId, actor })` scopes all tool calls to a stable example namespace.
- `memory.getSystemPrompt(basePrompt)` injects MemexAI's prompt block so the model knows how and when to use memory.
- `memory.createAgenticToolset()` exposes only `memory_remember` and `memory_context`, matching the recommended default workflow.
- The CLI forces `memory_remember` for `remember` and `memory_context` for `recall` via `activeTools` and `toolChoice`; this keeps smoke tests deterministic while still using the Vercel AI SDK tool loop.
- `remember` includes a code comment explaining the post-turn memorize pattern: real assistants often answer first, then run a focused memory extraction pass.

## Gaps / Missing Primitives

- No blocking SDK gap found for service mode. `@memexai/sdk` already exposes Vercel AI-compatible agentic tools.
- The public `@memexai/sdk` package is model-free, so `memory_remember` depends on the running service having a model configured. The current Docker service in this workspace is configured sufficiently for the smoke test.
- The repo root workspaces currently list only `apps/*` and `packages/*`, so examples are standalone. Existing examples use `workspace:*`, but `bun install` from this standalone example cannot resolve that, so this example uses `file:../../packages/sdk`.
- Product naming caveat: `MEMEX_USER_ID` maps to the current `userId` namespace field. A code comment warns that the product term may change later.

## Smoke Commands And Results

Commands run before implementation:

```bash
docker compose ps --format json
```

Observed service port:

```text
memexai-memexai-1: 0.0.0.0:18080->8080/tcp
memexai-postgres-1: 0.0.0.0:55433->5432/tcp
```

The example README and code default to `http://localhost:8080`, while smoke commands use the observed `http://localhost:18080`.

Health check:

```bash
curl -sS http://localhost:18080/health
```

Result:

```json
{"ok":true}
```

Authenticated `memory_list` check:

```bash
curl -sS -X POST http://localhost:18080/v1/tools/memory_list/execute \
  -H "Authorization: Bearer ${MEMEX_API_KEY_FROM_DOTENV}" \
  -H 'Content-Type: application/json' \
  -d '{"context":{"userId":"example_vercel_ai_service_user","actor":"validation"},"arguments":{"prefix":"user/"}}'
```

Result:

```json
{"files":[]}
```

Note: the already-running local container did not accept the literal documented default `dev-agent-key`; the repository `.env` supplies the API key used by this container. The example still defaults to `dev-agent-key` for compose-default setups.

Typecheck:

```bash
cd examples/vercel-ai-service
bun run typecheck
```

Result:

```text
$ tsc --noEmit
```

Live two-turn smoke:

```bash
MEMEX_URL=http://localhost:18080 bun run remember
MEMEX_URL=http://localhost:18080 bun run recall
```

Remember result:

```text
command: remember
memex_url: http://localhost:18080
memex_user_id: example_vercel_ai_service_user
tools: memory_remember

I've noted that you prefer ceramic pour-over coffee with oat milk before writing code.
```

Recall result:

```text
command: recall
memex_url: http://localhost:18080
memex_user_id: example_vercel_ai_service_user
tools: memory_context

You prefer ceramic pour-over coffee with oat milk before writing code.
```

Post-smoke memory API verification:

```bash
curl -sS -X POST http://localhost:18080/v1/tools/memory_list/execute \
  -H "Authorization: Bearer ${MEMEX_API_KEY_FROM_DOTENV}" \
  -H 'Content-Type: application/json' \
  -d '{"context":{"userId":"example_vercel_ai_service_user","actor":"validation"},"arguments":{"prefix":"user/"}}'
```

Result:

```json
{"files":[{"path":"user/index.md","size":81,"updatedAt":"2026-06-04T07:51:44.454Z"},{"path":"user/log.md","size":257,"updatedAt":"2026-06-04T07:51:54.652Z"},{"path":"user/profile.md","size":90,"updatedAt":"2026-06-04T07:51:42.924Z"}]}
```

Readback:

```bash
curl -sS -X POST http://localhost:18080/v1/tools/memory_read/execute \
  -H "Authorization: Bearer ${MEMEX_API_KEY_FROM_DOTENV}" \
  -H 'Content-Type: application/json' \
  -d '{"context":{"userId":"example_vercel_ai_service_user","actor":"validation"},"arguments":{"path":"user/profile.md"}}'
```

Result:

```json
{"path":"user/profile.md","content":"# Coffee Preferences\n- Prefers ceramic pour-over coffee with oat milk before writing code.","updatedAt":"2026-06-04T07:51:42.924Z"}
```
