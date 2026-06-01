# Write Founder Story
**Priority:** P3
**Type:** gtm-content
**Status:** [x] done

## Draft
The founder story is a debugging story: memory looked like an AI feature until it broke like product data.

The first time an agent gave a confidently wrong follow-up, the useful question was not "which prompt made it weird?" It was "what durable state did the agent read?" That led straight to the database. If memory affects a user's next answer, a founder or engineer should be able to inspect it, correct it, and see when it changed.

That is the core of MemexAI: not bigger context for its own sake, but a Postgres-backed memory record that can survive sessions and still be debugged with ordinary product instincts.

## Short Version
I got tired of debugging "AI memory" like fog. If a stored fact changes the next answer, I want to open the record, fix it, and see the revision trail. MemexAI is that loop, backed by Postgres.

## Verification
- Story supports the "memory as product data" launch frame.
- Story avoids overclaiming and keeps the technical hook concrete.
