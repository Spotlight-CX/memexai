# Homepage rationale

## Target persona

**Primary:** AI/backend engineer or technical founder who is already shipping an agent product and has noticed that it forgets users between sessions. They know what a vector database is. They've tried ad-hoc solutions (save to Redis, pass a JSON blob in the system prompt). They're looking for something drop-in, not another platform to buy into.

**Secondary:** Early-stage indie builder who saw a demo of an AI assistant that "remembered" them and wants the same for their product without building it from scratch.

## Page goal

Visitor leaves understanding that MemexAI is a specific piece of infrastructure — not a general AI memory SaaS or a cloud lock-in — and either copies the setup prompt into their coding agent or clicks into the quickstart. Conversion = "I know what this is and I want to try it."

## Section-by-section rationale

### §1 Hero
- **Goal:** Immediately name the problem the persona has felt ("forgets users between sessions") and frame MemexAI as infrastructure, not a feature.
- **Persona context:** Engineer arriving from Hacker News or a GitHub mention. Will skim-read. The headline must be a bug statement, not a pitch.
- **Design choices:** CopyButton as primary CTA lets a coding-agent user skip the docs entirely. "Paste into Cursor/Claude" de-risks the setup commitment. HeroFileAnimation shows the actual memory artifact (a Markdown file with revisions) rather than abstract product art.

### §2 Problem
- **Goal:** Validate that the visitor's pain is real and understood. Three cards = three specific failure modes, not one vague claim.
- **Persona context:** Engineer who has experienced at least one of these. The code-snippet examples make it concrete and credible.
- **Design choices:** Each card has a short code/output block to show the failure state, not just describe it. Avoids marketing language.

### §3 Solution
- **Goal:** Show what MemexAI actually is — Markdown files in Postgres, not embeddings, not a cloud API.
- **Persona context:** Engineer who has built with vector DBs and has an opinion about them. The "not embeddings as source of truth" framing speaks directly to that skepticism.
- **Design choices:** FileBrowser shows the actual file structure (user/ vs shared/) rather than a diagram. The two scope cards are minimal — just enough to show the mental model.

### §4 Shared Memory
- **Goal:** Show that MemexAI handles the "global policy" case (rules, schemas, agent behavior) not just per-user state.
- **Persona context:** Builder who has tried storing policies in the system prompt and knows it's fragile. The four cards map to real things they've wanted to do.
- **Design choices:** Four cards because there are genuinely four distinct use cases (rules, schemas, auto-injection, collective memory). None are placeholder.

### §5 Dreaming
- **Goal:** Address "what about memory growing unbounded?" — a real engineering concern for anyone thinking past the prototype.
- **Persona context:** Engineer thinking about production scale. "When does this become a problem?" This section preempts the objection.
- **Design choices:** Two cards (compaction + zero audit noise). Short copy. The "dream-agent" author detail is a credibility signal — shows the system is self-consistent, not a magic black box.

### §6 Trust / Debug
- **Goal:** Answer "how do I fix a wrong fact?" — the most common objection to any AI memory system.
- **Persona context:** Engineer who has been burned by AI hallucinations or stale data. Needs to see that humans stay in control.
- **Design choices:** DiffWidget shows the actual revision diff + access log. The copy leads with the action ("open the file and fix it") not the feature name.

### §7 Setup
- **Goal:** Show how easy integration actually is. Three paths (Docker, Direct PG, MCP) signal that it fits different deployment styles.
- **Persona context:** Engineer evaluating effort-to-value. The "4 lines" claim must be defensible — CodeSwitcher shows it literally.
- **Design choices:** CodeSwitcher with real working code. The agent prompt box at the bottom serves the "let my coding agent do it" persona.

### §8 Build vs Buy
- **Goal:** Answer "why not just build this myself?" — the default reaction from an engineer persona.
- **Persona context:** Engineer who has built things from scratch before and values that. The answer isn't "you can't" — it's "you can, but here are 6 things that bite you later."
- **Design choices:** Same mx-compare table pattern as §9 for visual consistency. Ends with an honest disclaimer ("no moat claims") to reinforce credibility over selling.

### §9 Compare
- **Goal:** Differentiate from Mem0 and Zep (the alternatives the persona will Google) and make the "DIY" column honest.
- **Persona context:** Engineer doing due diligence. The "Their cloud" vs "Your Postgres" framing speaks to the data ownership concern that technical buyers have.
- **Design choices:** 5-column table. "See full comparison" link goes to /compare for deeper detail.

### §10 Footer CTA
- **Goal:** Capture visitors who scrolled all the way down without converting. Multiple paths (docs, Docker, roadmap, Talk to us, Slack) so no one hits a dead end.
- **Design choices:** Dark band visually separates it from the content sections. Five CTAs = deliberate — matches the personas (reader, doer, evaluator, talker, community joiner).
