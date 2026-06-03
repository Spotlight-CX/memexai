# Research: Retrieval Approaches in Agent Memory Systems (2025–2026)

Survey of common retrieval architectures in the agent memory ecosystem.

---

## Retrieval strategy patterns

Agent memory products generally fall into a few retrieval architectures:

**Vector-only (embedding similarity)**
- Stores all memories as dense vectors; retrieval is approximate nearest-neighbor search.
- Good for paraphrase and semantic similarity; weak on exact-match facts (names, numbers, codes).
- Requires an embedding provider at both write and query time.

**BM25 / keyword-only**
- Sparse retrieval using TF-IDF or BM25 scoring against tokenized content.
- Reliable for exact-match and structured facts; misses semantic synonyms and paraphrase.
- Runs entirely in Postgres or Elasticsearch with no external provider dependency.

**Hybrid (BM25 + dense, fused with RRF)**
- Both signals run in parallel and are merged using Reciprocal Rank Fusion.
- More robust than either alone across query types — keyword queries preserved, paraphrase queries bridged.
- Growing industry default for production memory systems (2025–2026).

**Graph-backed retrieval**
- Memories stored as graph nodes with typed relations; queries traverse the graph.
- Adds temporal reasoning (how facts changed over time) and relationship-aware recall.
- Higher operational complexity; typically enterprise-tier rather than open-source default.

---

## Developer selection criteria (2025–2026)

From forum discussions and open-source community signals, developers choose agent memory products primarily based on:

1. **Self-hosting and data sovereignty** — ability to run entirely on-premises, no data leaving the deployment, EU AI Act and enterprise compliance pressure.
2. **Memory quality at write time** — whether the system reliably extracts and stores important facts, not just recent utterances.
3. **Temporal and relationship reasoning** — ability to track how facts change over time, not just what was said most recently.
4. **Pricing and access gates** — community frustration with essential features gated behind paid tiers.

Semantic/vector search is widely treated as table stakes — developers assume it exists and do not select based on its presence alone. The differentiation question is how well the system handles the harder cases: write-time quality, temporal memory, and operational simplicity.

---

## Write-time quality vs. retrieval quality

A recurring finding in community evaluations: retrieval quality improvements have diminishing returns when write-time quality is the primary bottleneck.

If the memorize step fails to extract a clearly-stated fact (the user said it plainly, but the system didn't record it), no retrieval method can recover it. Vector search on an empty or sparse memory store provides no benefit.

Analysis of memory evaluation datasets consistently shows:
- Majority of missed recalls are caused by facts that were never written.
- Minority are caused by vocabulary mismatch between the stored fact and the query (where hybrid search would help).

Practical implication: improving memorize recall (extracting more facts at write time) typically yields higher overall recall improvement than upgrading from BM25 to hybrid retrieval. Both improvements are worthwhile, but the ordering matters.

---

## Where hybrid retrieval is most valuable for personal memory

Hybrid search is most impactful for qualitative and preference-type memories — the category that differentiates memory systems from key-value stores:

- "User finds dense traffic stressful" ≠ "prefers quiet, nature-adjacent neighborhoods" (no token overlap, semantic bridge needed)
- "Loves being near trees and parks" ≠ "nature and green space preference" (same concept, different words)
- Specific facts: "2BHK Whitefield, 1.2Cr budget" → BM25 handles this reliably (shared tokens)

Hybrid search adds lift specifically in the preference and qualitative domain, which is also the hardest domain for BM25 alone.
