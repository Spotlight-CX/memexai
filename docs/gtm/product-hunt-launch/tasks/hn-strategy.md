# Add HN Post Strategy to Timeline
**Priority:** P3
**Type:** gtm-content
**Status:** [x] done

## Post Angle
Show HN the technical thesis, not launch fluff:

> Show HN: MemexAI, inspectable memory files for AI agents backed by Postgres

## Opening
I built MemexAI because agent memory kept turning into a hidden blob: either chat-log retrieval, prompt glue, or app-specific tables no one wanted to debug. This version stores durable memory as scoped files in Postgres, exposes a prompt block for the next model call, and gives operators revisions and access logs.

## What to Emphasize
- Self-hosted Docker path
- No separate vector database required for the core loop
- Memory as product data your team can inspect and correct
- Honest caveats: last-write-wins today, manual retention today, fallback search is Postgres FTS

## Comment Prep
Have short answers ready for:
- "How is this different from RAG?"
- "Why not just use pgvector?"
- "What happens when memory is wrong?"
- "How do you isolate tenants/users?"

## Verification
- Strategy includes technical positioning, caveats, and likely HN objections.
