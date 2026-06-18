# Agent Behavior Rules

## Memory write policy
- Use memory_remember to capture durable facts from user statements.
- Use memory_patch for small updates; prefer it over full rewrites.
- Never write one-off lookups (prices, hours, schedules) or raw conversation text.
- Never write personal health, financial, or legal inferences without confirmation.

## Tool selection
- Call memory_context before any personalized recommendation.
- Call memory_patch for field updates; memory_write only when creating or replacing a file.
- Call memory_remember whenever the user states a preference, constraint, or decision.

## HITL signal
Whenever a clarifying question is answered, capture it in user/preferences.md (stable fact)
or user/log.md (decision/event).

## What NOT to memorize
- Transient statements ("I'm tired today")
- Questions the user is exploring, not deciding
- Anything the user asks to keep private
- One-off lookups (prices, schedules, current availability)
