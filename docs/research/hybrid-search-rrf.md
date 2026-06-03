# Research: Hybrid Search with Reciprocal Rank Fusion

Supporting research for [`docs/roadmap/003-hybrid-search-rrf.md`](../roadmap/003-hybrid-search-rrf.md).

---

## Academic basis

### Reciprocal Rank Fusion (RRF)

Cormack, Clarke, Buettcher. "Reciprocal Rank Fusion outperforms Condorcet and individual rank learning methods." SIGIR 2009.

- Formula: `score(d) = Σ 1/(k + rank(d))`, where k=60 is the standard default
- Consistently outperforms either BM25 or vector search alone across a wide range of retrieval benchmarks
- No training required; k=60 is robust across corpora

Intuition on k=60: score at rank 1 is 1/61 ≈ 0.0164; score at rank 100 is 1/160 ≈ 0.006. The vector component has meaningful influence only when it surfaces a document in the top-5 that BM25 missed entirely. When BM25 and vector agree on the top results, fusion changes nothing. When they disagree, fusion wins precisely in the vocabulary-mismatch cases where BM25 fails.

### BEIR Benchmark

Thakur et al. "BEIR: A Heterogeneous Benchmark for Zero-shot Evaluation of Information Retrieval Models." NeurIPS 2021. [Paper](https://datasets-benchmarks-proceedings.neurips.cc/paper/2021/file/65b9eea6e1cc6bb9f0cd2a47751a186f-Paper-round2.pdf)

18 heterogeneous corpora, zero-shot evaluation:

| Approach | Avg NDCG@10 |
|---|---|
| BM25 alone | ~0.434 |
| Hybrid (BM25 + dense + reranking) | ~0.526 |
| Dense alone | typically below hybrid, below BM25 on several corpora |

**Where BM25 beats dense retrieval:**
- Touché-2020 (argument retrieval, long documents >300 words): BM25 NDCG@10 = 0.367; every tested neural model falls below this. Long documents give BM25's TF-IDF signal more statistical surface area.
- NFCorpus (medical, short queries vs. long docs): dense models struggle with out-of-vocabulary biomedical terms.
- Domain-specific corpora with rare entities: exact-match retrieval favors BM25.

**Where dense/hybrid wins:**
- FiQA (financial QA, paraphrase-heavy): dense and hybrid dominate.
- SciFact, ArguAna: semantic expansion outperforms BM25 substantially.
- HotpotQA, NQ: multi-hop or reformulated natural language queries strongly favor dense encoding.

**The pattern:** BM25 dominates when query vocabulary closely matches document vocabulary. Dense and hybrid win when there is a lexical chasm — when query and relevant document use systematically different words for the same concept.

### Hybrid RRF production lift

Evidence from production teams (2025–2026):

- Hybrid RRF provides roughly +8 percentage points Recall@5 over BM25 alone in out-of-domain retrieval tasks.
- Lift is query-type dependent: pure exact-match queries (error codes, identifiers, product names) see no benefit from the vector component. BM25 ranks them correctly and RRF preserves the rank. Vector adds noise in those cases.
- Generic embedding models on specialized domains (medical, legal, niche technical vocabulary) can reduce hybrid precision if not fine-tuned — the vector component degrades rather than improves results.
- Marginal lift over BM25 alone is 2–9 points NDCG and is concentrated in paraphrase and synonym failure modes.

---

## Why BM25 alone falls short for personal memory

Personal memory files use natural language paraphrases. A user who says "I love being near trees and parks" stored as a memory note will not be found by a query like "nature preference" or "green space" — no tokens overlap. BM25 requires lexical overlap; vector search bridges the paraphrase gap.

Hybrid search preserves BM25 recall for exact-keyword facts (numbers, names, addresses, model numbers) while adding semantic recall for preference and qualitative statements.

For agent memory specifically: when the agent issues a search on behalf of a user who wrote one thing but now asks about it differently, the vocabulary mismatch failure is invisible to the agent — it simply gets fewer results and answers with less context.

---

## LongMemEval: failure taxonomy in agent memory

LongMemEval is an open benchmark for long-context memory recall across multi-turn conversations. Relevant findings for retrieval design:

**Memorize quality is the primary bottleneck.** Analysis of failed recall cases shows approximately 65–88% of failures involve facts that the user stated clearly in conversation but that the memorize step never extracted and stored. These are not retrieval failures — the fact was never written. Vector search cannot recover unwritten facts.

**When facts are written, retrieval token overlap is near-zero.** The stored note (e.g., "degree: Business Administration") and the query (e.g., "what degree did the user earn?") share the token "degree" — this is BM25-retrievable once the fact is stored. Most structured preferences, when properly extracted, are BM25-findable.

**Where vector search helps in the memory domain:** The cases where retrieval fails despite the fact being written are typically qualitative/preference facts — "user finds dense traffic stressful" does not share tokens with "nature-adjacent neighborhood preference." These are the category where hybrid search provides lift over BM25 alone.

**Multi-session aggregation is a separate problem.** Questions that require counting or summing across multiple sessions (total days across three camping trips; recurring patterns across six months) fail for reasons unrelated to retrieval method — the agent must read and aggregate multiple memory files, which is an agent-reasoning problem, not a retrieval problem.

**Summary for implementation priority:**
1. Memorize extraction quality (write the right facts): highest leverage, ~65–88% of failures
2. Hybrid retrieval (find semantically relevant facts): meaningful lift for qualitative/preference facts, ~8–20 point accuracy improvement on paraphrase-heavy recall tasks
3. Multi-session aggregation: requires agent reasoning, not a retrieval improvement

---

## Why pgvector is viable infrastructure

- `pgvector/pgvector:pg16` is the official pgvector Docker image — no additional infrastructure beyond switching the Postgres image tag.
- HNSW index brings approximate nearest-neighbor search latency to sub-10ms for typical corpus sizes.
- The `<=>` cosine distance operator integrates naturally with existing PostgreSQL queries, row-level access filters, and transaction semantics.
- Switching the compose image from `postgres:16-alpine` to `pgvector/pgvector:pg16` is a one-line change with no schema impact for BM25-only deployments.
