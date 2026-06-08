# OpenAI SDK Service Example Research

## Docs Read

- OpenAI Chat Completions API reference, current as checked on 2026-06-04: Chat Completions tool calls finish with `finish_reason: "tool_calls"` and return `message.tool_calls`; each function call has an `id`, `function.name`, and JSON-encoded `function.arguments`. Tool results are sent back as `role: "tool"` messages with the matching `tool_call_id`.
- OpenAI function calling guide, current as checked on 2026-06-04: tool calling is a loop of model request, tool call response, local execution, tool output message, and another model request. The guide recommends handling multiple tool calls.
- Google Gemini OpenAI compatibility docs, current as checked on 2026-06-04: the TypeScript OpenAI SDK can call Gemini by setting `apiKey` to a Gemini API key, `baseURL` to `https://generativelanguage.googleapis.com/v1beta/openai/`, and using a Gemini model such as `gemini-2.5-flash`.
- Local MemexAI OpenAI adapter docs: `apps/website/content/docs/adapters/openai.mdx`.
- Local adapter source: `packages/sdk/src/adapters/openai.ts`.

## Versions

- `openai`: `^6.42.0` (`npm view openai version` returned `6.42.0`).
- `tsx`: `^4.22.4` (`npm view tsx version` returned `4.22.4`).
- `typescript`: `^5.9.3`, matching the repository TypeScript line rather than moving the standalone example to TypeScript 6.
- `@memexai/sdk`: `file:../../packages/sdk` so the example type-checks against this repository's SDK while remaining service-mode only.

## Rationale

- The example uses `@memexai/sdk` and `MemexAI({ url, apiKey })`, then scopes memory with `forUser({ userId, actor })`.
- The example does not import `@memexai/core`, does not connect to Postgres, and does not run migrations. Docker/service mode owns those concerns.
- The CLI intentionally runs two model turns: one turn that should call `memory_remember`, then one turn that should call `memory_context`.
- Tool execution goes through `createOpenAITools(memory).execute(...)` so MemexAI records the OpenAI tool call ID in service revisions/access logs when available.
- The code comments call out post-turn memorize as a production pattern and note that duplicate reduction works best when only compact new facts are submitted.

## Gaps And Compatibility Notes

- The current MemexAI OpenAI adapter emits flat tool definitions: `{ type, name, description, parameters }`. OpenAI Chat Completions currently expects tools nested as `{ type: "function", function: { name, description, parameters } }`. The example keeps a local conversion helper and still uses the adapter for definitions and execution.
- Gemini's OpenAI-compatible endpoint is documented for function calling, but compatibility endpoints have historically varied in tool-call ID behavior. The example normalizes missing tool call IDs before adding assistant/tool messages to the loop.
- No shared SDK changes were made. If this example should pass adapter definitions directly to Chat Completions without the local conversion helper, the SDK adapter should be updated in a separate shared-scope change.

## Smoke Commands And Results

The default `docker compose up -d` first failed in this machine because another worker already had host port `5433` allocated. I started this worktree's stack on isolated ports:

```bash
POSTGRES_PORT=25433 MEMEX_PORT=28080 docker compose up -d
POSTGRES_PORT=25433 MEMEX_PORT=28080 docker compose ps
```

Result:

```text
memexai-openai-sdk-service-memexai-1    Up    0.0.0.0:28080->8080/tcp
memexai-openai-sdk-service-postgres-1   Up    0.0.0.0:25433->5432/tcp (healthy)
```

Health:

```bash
curl -s http://localhost:28080/health
```

Result:

```json
{"ok":true}
```

Initial memory list:

```bash
curl -s -H "Authorization: Bearer dev-agent-key" \
  -H "Content-Type: application/json" \
  -d '{"context":{"userId":"openai-sdk-service-demo-user","actor":"smoke"},"arguments":{"prefix":"user/"}}' \
  http://localhost:28080/v1/tools/memory_list/execute
```

Result:

```json
{"files":[]}
```

The first CLI attempt reached Gemini but failed because the service container had no model configured:

```text
MemexAIError: memory_remember requires a configured model
code: MODEL_NOT_CONFIGURED
```

I then put the Gemini key into the worktree root `.env` without printing it, set `MEMEX_LLM_PROVIDER=google`, and recreated the service. Logs confirmed:

```text
MemexAI model provider: google/gemini-2.5-flash
search mode: hybrid (gemini/gemini-embedding-001, 768 dims)
```

Type/build checks:

```bash
bun install
bun run build:sdk
cd examples/openai-sdk-service
npm install
npm run typecheck
```

Results:

```text
bun run build:sdk: success
npm install: added/audited packages; npm reported 3 low severity vulnerabilities
npm run typecheck: success
```

CLI smoke:

```bash
npm run start -- "I prefer 2BHK apartments."
```

Result:

```text
MemexAI service: http://localhost:28080
MemexAI user: openai-sdk-service-demo-user
Model: gemini-2.5-flash

Turn 1 - remember
User: Remember this durable preference: I prefer 2BHK apartments.
Assistant: I've noted that you prefer 2BHK apartments.

Turn 2 - recall
User: What apartment size do I prefer? Answer from memory only.
Assistant: You prefer 2BHK apartments. (Source: `user/preferences.md`)
```

Memory search verification:

```bash
curl -s -H "Authorization: Bearer dev-agent-key" \
  -H "Content-Type: application/json" \
  -d '{"context":{"userId":"openai-sdk-service-demo-user","actor":"smoke"},"arguments":{"query":"apartment size preference","prefix":"user/"}}' \
  http://localhost:28080/v1/tools/memory_context/execute
```

Result excerpt:

```json
{
  "results": [
    {
      "path": "user/preferences.md",
      "snippet": "I prefer 2BHK apartments."
    }
  ],
  "answer": "You prefer 2BHK apartments.\n\nSource: `user/preferences.md`",
  "sources": ["user/preferences.md"]
}
```

Memory read verification:

```bash
curl -s -H "Authorization: Bearer dev-agent-key" \
  -H "Content-Type: application/json" \
  -d '{"context":{"userId":"openai-sdk-service-demo-user","actor":"smoke"},"arguments":{"path":"user/preferences.md"}}' \
  http://localhost:28080/v1/tools/memory_read/execute
```

Result:

```json
{"path":"user/preferences.md","content":"I prefer 2BHK apartments.","updatedAt":"2026-06-04T07:53:15.057Z"}
```

Admin API verification:

```bash
curl -s -H "x-admin-secret: dev-admin-secret" \
  "http://localhost:28080/v1/admin/files?userId=openai-sdk-service-demo-user"
```

Result excerpt:

```json
{
  "physicalPath": "users/openai-sdk-service-demo-user/preferences.md",
  "size": 25
}
```
