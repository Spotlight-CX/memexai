// The exact content of shared/index.md after migration 008.
// If the live file matches this, the operator has not yet customized shared memory
// and the first-run modal should be shown.
export const SEED_SHARED_INDEX_MD = `# MemexAI Memory

\`shared/\` is read-only guidance for all agents. \`user/\` is each user's private writable workspace.

## Shared files

- \`shared/user-memory.md\` — rules for what to store, patch, and ignore
- \`shared/domain.md\` — product-specific memory categories and examples

## Expected user files

| File | What belongs here |
|---|---|
| \`user/index.md\` | Registry of all user files and what they cover |
| \`user/preferences.md\` | Durable soft preferences — refinable over time |
| \`user/constraints.md\` | Hard blockers — budget ceilings, allergies, banned options |
| \`user/goals.md\` | Active intentions — mark completed when resolved |
| \`user/history.md\` | Key events and decisions — append-only |

## Memory taxonomy

- **Preference** — soft, refinable. Patch when updated. \`- Prefers boutique hotels [2025-01]\`
- **Constraint** — hard blocker. Never override without explicit correction. \`- No peanuts (allergy) [2025-01]\`
- **Goal** — time-bound. Mark done when resolved. \`- Trip to Bali, Q3 2025 [open]\`
- **Episode** — what happened. Append to \`history.md\` only; never patch. \`- Booked Seminyak villa [2025-03]\`

## Timestamp convention

Append \`[YYYY-MM]\` when writing a fact. Update the timestamp when patching. This is the only recency signal — revisions track file-level history, not line-level.

## What NOT to store

- One-off lookups (prices, hours, transit schedules)
- Emotional venting with no durable signal
- Information about other people the user mentioned
`
