# Storylines And Positioning

## Primary Storyline

**AI memory should change the next response, then show its work.**

Most agent memory demos stop at storage. That is fine until the next session still feels generic, a user asks why the agent remembered something, an operator needs to correct it, or a team wants to understand which memory changed after a bad answer.

MemexAI closes the loop: durable memory is stored as scoped, Markdown-like files in Postgres, injected into the next model call through a prompt block, and inspected through an admin UI with files, revisions, access logs, search, and optional background consolidation.

| Why this storyline matters | Importance |
|---|---:|
| It names the market problem without sounding like a generic memory SDK or storage wrapper. | 10 |
| It explains why Postgres, files, revisions, and admin UI belong together. | 10 |
| It gives Product Hunt commenters a clear debate: should AI memory be inspectable product state? | 9 |

## One-Line Positioning Options

| Option | Use | Rationale | Importance |
|---|---|---|---:|
| AI responses that remember users across sessions. | Default tagline candidate | Names the behavioral outcome, under 60 characters. | 10 |
| Memory that changes the next AI response. | PH thumbnail / hero | Makes prompt injection the product moment. | 10 |
| Inspectable memory files for AI products. | PH thumbnail / hero | Shorter and more differentiated. | 9 |
| Give agents memory your team can review. | Social post hook | Human benefit plus technical trust without implying compliance-grade audit. | 8 |
| Durable user memory without a vector database. | Dev audience variant | Strong for technical skepticism. | 7 |
| Agent memory that stays readable over time. | Dreaming story | Good for consolidation content. | 7 |

Recommended Product Hunt tagline:

> AI responses that remember users across sessions

Rationale: It is exact, under the 60-character limit, and leads with the product moment instead of the storage layer.

Clickable Product Hunt feed variant to test:

> Memory that changes the next AI response

Rationale: This is less complete but more curiosity-driving. Use it if the Product Hunt draft preview feels too infrastructure-heavy in the feed.

## Narrative Pillars

### 1. Prompt Block Loop

Memory should be written, injected into the next model call, and verified through a changed response.

| Rationale | Importance |
|---|---:|
| It prevents the launch from sounding like storage without behavior. | 10 |
| It gives demos a crisp two-turn proof. | 10 |

### 2. Memory Files

Agents write durable memory to virtual paths like `user/profile.md` and `shared/policy.md`.

| Rationale | Importance |
|---|---:|
| File paths are familiar to developers and easy to show visually. | 9 |
| This differentiates from opaque extracted-memory stores. | 8 |

### 3. Postgres Native

Memory, revisions, access logs, migrations, and search live in Postgres.

| Rationale | Importance |
|---|---:|
| Many AI product teams already trust and operate Postgres. | 10 |
| It removes the need to pitch yet another infrastructure dependency. | 9 |

### 4. Inspectable Admin UI

Operators can inspect memory files, users, revisions, access logs, Dreaming runs, and observability.

| Rationale | Importance |
|---|---:|
| Screenshots make the product feel real immediately. | 10 |
| PH visitors understand "control" faster when they see it. | 10 |

### 5. Revisions And Access Logs

Every write creates a revision. Reads and writes are logged.

| Rationale | Importance |
|---|---:|
| This answers trust and debugging objections. | 10 |
| It turns "auditable" from a claim into a mechanism. | 9 |

### 6. Dreaming

Optional model-assisted background consolidation helps keep memory readable by merging duplicates, compacting fragmented notes, and handling direct contradictions through normal memory writes.

| Rationale | Importance |
|---|---:|
| The market is waking up to memory maintenance, not just memory storage. | 9 |
| It gives the launch a timely hook when framed as reviewable consolidation rather than guaranteed semantic correctness. | 8 |

## Storyline Variants By Audience

| Audience | Hook | Why it lands | Importance |
|---|---|---|---:|
| AI app founders | "Your next AI response should change because memory exists." | They care about retention, personalization, and support/debug loops. | 10 |
| Infra-minded developers | "Postgres-backed memory files, tools, revisions, access logs." | Concrete architecture beats magic claims. | 10 |
| Agent builders | "Two memory tools plus scoped files." | Minimal integration surface matters. | 8 |
| Open-source users | "Self-hostable memory service with Docker, TS, Python, REST, MCP." | Reduces adoption risk. | 9 |
| Skeptics | "Not every chat needs to become memory." | Shows taste and restraint. | 8 |

## Copy Guardrails

- Say "durable memory" instead of "infinite memory."
- Say "memory is only valuable when it changes the next answer" when explaining why prompt injection matters.
- Say "background consolidation" instead of "agents dream like humans."
- Say "no separate vector database required" instead of "vectors are bad."
- Say "inspect, correct, and review" in broad launch copy. Use "revision and access history" when the exact control surface matters.
- Say "early stage" when appropriate; the README already does this credibly.

## Launch-Day Story Arc

1. **Problem:** Agents forget because stored memory often never reaches the next response.
2. **Belief:** Memory is only valuable when it changes the answer and teams can inspect why.
3. **Product:** MemexAI gives agents scoped memory tools, a prompt block, and Postgres-backed files.
4. **Trust:** Humans get an admin UI, revisions, access logs, and path-enforced isolation.
5. **Maintenance:** Dreaming helps keep memory clean over time through normal reviewable writes.
6. **Ask:** Try the two-turn proof with Docker or the setup file, and tell us what memory workflows your AI product needs.

## What MemexAI Is Not

| Not this | Say this instead | Rationale | Importance |
|---|---|---|---:|
| A compliance audit system | MemexAI provides revision and access history for debugging and operational review. | Avoids overclaiming "audit" in regulated contexts. | 10 |
| Raw transcript storage | MemexAI stores the durable working set an agent should carry forward. | Prevents confusion with chat log RAG. | 10 |
| A replacement for app-level tenancy | MemexAI enforces memory path scopes inside its own service/tool layer. | Sets correct security expectations. | 9 |
| A vector database replacement for all retrieval | MemexAI can coexist with vector search; it owns durable memory records. | Makes the vector comparison more credible. | 8 |
| Magical autonomous memory cleanup | Dreaming is optional model-assisted consolidation through normal reviewable writes. | Keeps the novel feature trustworthy. | 9 |
