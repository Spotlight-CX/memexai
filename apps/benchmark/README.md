# MemexAI Benchmarking

MemexAI should publish reproducible memory results, not broad "best memory" claims. Competitors often show LongMemEval, LoCoMo, latency, token savings, or benchmark rankings. Use those signals, but pair them with MemexAI-specific operability metrics.

## What to Measure

- Recall quality: LongMemEval-S exact match and F1, broken down by question type.
- Reliability: whether a durable fact was written, retrieved, cited, and answerable.
- Operator score: whether a failure can be explained from revisions, access logs, and a time-travel snapshot.
- Latency and cost: report ingest/write latency separately from query latency.
- Memory hygiene: duplicate rate, stale-file rate, hot/cold files, and files compacted or split by dreaming.

## Service-Mode Smoke Run

Use this before publishing any public number. It talks to the Docker service, so it exercises the recommended production path.

```bash
docker compose up -d

bun run bench:docker-smoke -- \
  --limit 5 \
  --max-sessions 3 \
  --batch-size 1 \
  --output apps/benchmark/data/docker-smoke-results.json
```

Record the exact service configuration with the result:

- dataset path and dataset version
- model provider and model used by the service
- `MEMEX_SEARCH_MODE`
- whether pgvector/hybrid search was enabled
- item limit and max sessions per item
- timestamp and run ID

## Direct-Postgres LongMemEval Run

Use this for lower-level recall experiments against `@memexai/core`.

```bash
DATABASE_URL=postgresql://memexai:memexai@localhost:5433/memexai \
GEMINI_API_KEY=$GEMINI_API_KEY \
bun run bench:longmemeval -- \
  --limit 10 \
  --output apps/benchmark/data/results.json
```

The script reports exact match, F1, ingest latency, retrieval/tool latency, end-to-end answer latency, token usage when the model provider returns it, search mode, trace IDs, and per-question-type breakdowns.

Each result row includes:

- `retrieval_latency_ms` and `end_to_end_latency_ms`
- `input_tokens`, `output_tokens`, and `total_tokens`
- `search_mode`
- `trace_id`, `tool_call_id`, and `ingest_trace_ids`
- reliability flags: `written`, `retrieved`, `cited`, `answerable`
- `operator_explainable`, which is true when the row can be joined back to local MemexAI trace data

## Publishing Rules

- Do not claim "#1" unless the harness, dataset, model, and output are public and reproducible.
- Always separate write/ingest time from query time; agentic writes are intentionally more deliberate.
- Always report accuracy with latency and token usage. If token usage is unavailable from the provider, report `null` rather than estimating silently.
- Include failed examples and explain whether the miss was a write failure, retrieval failure, answer synthesis failure, or stale memory problem.
- Pair benchmark numbers with screenshots or admin traces showing how an operator would debug the same failure.
