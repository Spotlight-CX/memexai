# Compare page rationale

## Target persona

Engineer or technical buyer who has already heard of MemexAI and is now doing due diligence against Mem0, Zep, or a DIY approach. They have a specific concern (data ownership, revision history, self-hosting, cost) and want a side-by-side answer.

## Page goal

Visitor finds the specific comparison they care about and either clicks through to a dedicated comparison page or goes directly to the quickstart. Conversion = clarity on the one dimension that was blocking them.

## Section rationale

### Overview table
- **Goal:** Surface the 5-6 most decision-relevant dimensions quickly. Don't enumerate everything — pick the questions a technical buyer actually asks.
- **Design choices:** MemexAI column highlighted with accent border (not just green checkmarks). "Their cloud" vs "Your Postgres" framing keeps it honest — doesn't pretend others are bad, just different trade-offs.

### Individual comparison pages (Mem0, Zep, vector DB, MaxiMem)
- **Goal:** Serve the "MemexAI vs X" Google query with a focused, honest comparison for a specific alternative.
- **Persona context:** Person who already uses or is evaluating a specific tool. They know the competitor — don't explain it to them, compare directly.
- **Design choices:** Each dedicated page should go deeper than the overview table, covering migration path, use-case fit, and specific trade-offs the overview skips.
