# MemexAI Examples

Each example shows where MemexAI fits in a framework's normal agent loop. MemexAI does not automatically watch every message or tool result; your app chooses when to call memory.

| Framework | Native memory abstraction? | Recommended MemexAI surface | Hot path | Background path |
|---|---:|---|---|---|
| Vercel AI SDK service | No | `createVercelAITools(memory)` plus `memory.remember(...)` | `vercel-ai-service/src/hot-path.ts` | `vercel-ai-service/src/background-path.ts` |
| Vercel AI SDK direct | No | `@memexai/core` user + Vercel tools | `vercel-ai/src/hot-path.ts` | `vercel-ai/src/background-path.ts` |
| OpenAI SDK | No | `createOpenAITools(memory)` plus manual tool execution | `openai-sdk-service/src/hot-path.ts` | `openai-sdk-service/src/background-path.ts` |
| Anthropic SDK service | No | `createAnthropicTools(memory)` and `handleAnthropicToolCall(...)` | `anthropic-service/src/hot-path.ts` | `anthropic-service/src/background-path.ts` |
| Anthropic SDK direct | No | `@memexai/core` Anthropic adapter | `anthropic/src/hot-path.ts` | `anthropic/src/background-path.ts` |
| LangChain Python | Tool abstraction | `get_langchain_tools(memory, mode="subagent")` or `mode="raw"` | `langchain-python/hot_path_subagent.py` and `langchain-python/hot_path_raw.py` | `langchain-python/background_path.py` |
| LangGraph Python | Graph/node abstraction | LangChain adapter plus graph-owned extraction node | `langgraph-python/hot_path.py` | `langgraph-python/background_path.py` |
| LlamaIndex Python | Tool abstraction | `get_llamaindex_tools(memory, mode="subagent")` | `llamaindex-python/hot_path.py` | `llamaindex-python/background_path.py` |
| CrewAI Python | Task/tool abstraction | `get_crewai_tools(memory, mode="subagent")` | `crewai-python/hot_path.py` | `crewai-python/background_path.py` |
| Google ADK Python | Yes | `MemexAdkMemoryService` | `google-adk-python/hot_path.py` | `google-adk-python/background_path.py` |

## Hot Path vs Background Path

Both are valid.

- **Hot path**: call `memory_remember` or `memory_context` inline when the current answer depends on memory or the user expects an immediate durable save.
- **Background path**: enqueue extraction after the response when latency matters, or when you want to batch, dedupe, review, or run a cheaper extractor.

The common rule is the same: pass compact durable text, not raw logs or every turn.

## Shared Systemic Insights

For trusted deployments, operational facts such as API limitations or SQL dialect quirks can route to `shared/` by combining:

- a routing table in `shared/index.md`
- `MEMEX_SHARED_WRITE_MODE=rw`

Keep user-private facts under `user/`. Shared writable mode is off by default and should not be enabled for untrusted agents.
