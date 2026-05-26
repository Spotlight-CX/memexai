# MemexAI GTM content plan

Last updated: 2026-05-26

## Working thesis

The market is moving from "memory as retrieval" to "memory as operational context." Long-horizon agents do not only need a larger context window; they need a durable, inspectable place to accumulate experience, instructions, corrections, and environment-specific knowledge across sessions.

MemexAI should own the position: memory that product teams can inspect, edit, audit, and use as part of the agent's behavioral control plane.

## Research anchors

- Anthropic's Managed Agents memory launch emphasizes file-backed memory, scoped permissions, audit logs, API control, rollback/redaction, and cross-agent sharing. This validates MemexAI's file-oriented, scoped, auditable direction.
- Anthropic's long-running agents work frames successful long-horizon work around environment scaffolding, progress files, incremental tasks, verification, and getting up to speed from prior state. This supports "memory as trajectory infrastructure," not just preference recall.
- Claude's context engineering cookbook frames context as a finite resource and calls out file-backed memory so a later session can pick up where an earlier session ended.
- LongMemEval defines long-term memory around extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention. Those categories are useful for MemexAI copy because they are more rigorous than vague personalization.
- Mem0's paper positions memory as dynamic extraction, consolidation, and retrieval from ongoing conversations. The comparison should be respectful: Mem0 is strong for extracted memory and managed/off-the-shelf memory; MemexAI is different because the record is directly inspectable product data.
- Zep's paper positions Zep around Graphiti, a temporally-aware knowledge graph that synthesizes conversational and business data. The comparison should acknowledge graph strengths while explaining the operational weight and editability tradeoff.
- MemGPT establishes memory tiers and OS-style context management as an early conceptual foundation. MemexAI can inherit this frame while choosing a simpler Postgres/files operating model.
- The Living Wiki paper describes an LLM-maintained, human-readable, markdown knowledge base with a separate governing protocol. This strongly supports docs and blog content on shared memory as a tool guide or behavioral guide.

## Content pillars

### 1. Long-horizon agents need trajectory memory

Hypothesis: long-horizon agent performance improves when the agent can carry forward verified state, failures, preferences, project rules, and next actions across context windows and sessions.

Assets:
- Blog: "Long-horizon agents need memory for trajectories, not just facts."
- Homepage and comparison copy: replace generic "persistent memory" claims with language about decisions, constraints, corrections, and progress.
- Social hooks:
  - "A long-horizon agent is not one prompt. It is a trajectory. Memory is how the trajectory survives."
  - "The bottleneck is not only context length. It is whether the next session knows what the last session learned."

### 2. Stop running evals only on prompts

Hypothesis: many teams overfit prompt evals while the production behavior is shaped by memory state, tool guides, shared policies, and retrieval traces.

Assets:
- Blog: "Stop running evals only on prompts. Your memory changes behavior too."
- Docs: "Shared memory as behavior guide" under Concepts.
- Social hooks:
  - "Your prompt is not the whole system prompt anymore. Your memory is part of the behavior."
  - "If an agent reads shared/AGENTS.md before acting, eval the memory too."

### 3. Inspectable memory is the trust surface

Hypothesis: memory becomes product data once it affects UX. Product data needs inspection, correction, revision history, and access logs.

Assets:
- Comparison pages: Mem0, Zep, vector DB, and overview with deeper tradeoffs.
- Docs cross-links to revisions, access logs, and scopes.
- Social hooks:
  - "If a memory changes the answer, a human should be able to open it."
  - "Wrong memory is not a model mystery. It is an operational record."

## Execution order

1. Ship blog index plus two deep posts.
2. Expand comparison pages with source-backed technical distinctions.
3. Add docs page for shared memory as a behavioral/tool guide.
4. Update footer, sitemap, and metadata.
5. Run website typecheck/build before commit.

## Notes for future GTM

- Avoid claiming MemexAI is categorically better than Mem0 or Zep. The credible claim is narrower: MemexAI is better when the memory record must be inspectable, editable, auditable, and easy to self-host in Postgres.
- Use "memory files," "revision history," "access logs," "shared guidance," "scoped user memory," and "Postgres-native" consistently.
- Keep canonical URLs on `https://memexai.space`.
