# Persona: Agentic Engineer Admin

## Who they are

An engineer who integrated memexai into an AI product. They're not a memory user themselves — they're the person responsible for making the memory system work well for their users and agents. They've connected an LLM harness to the memory tools (`memory_list`, `memory_read`, `memory_write`, `memory_patch`) and are now watching what the agent actually does with it.

They care deeply about **quality and reliability**, not aesthetics. They open the admin UI when something feels off — a response that seemed to ignore prior context, a user complaint, or a gut feeling that the agent is writing junk.

---

## Primary goals

1. **Understand what the agent is storing** — Is the memory well-structured? Is it the right level of detail? Is it useful or noisy?
2. **Find what got lost** — Why did the agent ignore a preference? Was it never written? Written to the wrong file? Written with a bad reason?
3. **Assess memory health** — Are files growing stale? Are key files being updated regularly? Is the agent over-writing or under-writing?
4. **Debug agent behavior** — Who wrote this, when, why? What operation was used? Does the reason string explain the decision?
5. **Intervene when needed** — Edit, delete, or rewrite a bad memory entry directly (Phase 3 feature). For now: identify what needs fixing and patch it via the API.

---

## The 5 questions they ask every session

1. **"What is in this file right now?"** → Needs the current content, fast, without friction.
2. **"Who last touched this and why?"** → Actor, operation type, and the reason string from the latest revision.
3. **"Is this file stale or actively updated?"** → Last-updated timestamp + revision count as a proxy for activity.
4. **"Is the agent writing to the right files?"** → Scanning the tree to see if structure makes sense, or if the agent is creating random files.
5. **"What happened right before this broke?"** → Revision history to diff current vs prior state.

---

## Frustrations with the current UI (v1 baseline)

- Equal-weight tabs for Files / Revisions / Logs create visual noise — they're secondary tools, not primary views.
- The file header shows size + date but not WHO wrote it or WHY — the most diagnostic fields.
- ASCII `v`/`>` in the tree slows scanning; a real file tree (VS Code-style) lets muscle memory take over.
- "Forget secret" is confusing brand language; "Sign out" is what they expect.
- No quick scan of file activity — hard to tell which files are hot vs cold at a glance.

---

## Design principles derived from this persona

- **Files view is the default and dominant surface.** Everything else (Users, Revisions, Logs) is an overflow/diagnostic tool.
- **The file header should answer question 2 and 3 before the content is read.** Actor + reason + timestamp above the fold.
- **The tree is a navigation tool, not a feature.** Make it fast, predictable, and invisible — like VS Code.
- **Density matters.** This person scans quickly. Compact rows, no wasted whitespace.
- **No placeholders.** If a field is empty (no revisions, no actor), omit it rather than showing an empty badge.
