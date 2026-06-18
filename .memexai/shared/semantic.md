# Semantic Memory Schema

Semantic memory holds stable, deduplicated facts about a user.

## What belongs in user/preferences.md
- Stated preferences (soft, refinable — patch when updated)
- Hard constraints (non-negotiable blockers)
- Active goals with a time horizon

Format: `- Fact description [YYYY-MM]`
When patching, update the timestamp and remove the old line.

## What NOT to store
- One-off lookups, raw conversation text, transient questions
- Anything the user explicitly asked to forget
