-- Transition to cognitive-architecture triad: procedural, semantic, episodic.
-- Replaces the old 4-category taxonomy (Preference/Constraint/Goal/Episode) with
-- three purpose-specific files that map clearly to both shared/ (schema) and user/ (instances).

-- 1. Update shared/index.md to a routing catalog for the triad.
INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_008_index',
  'shared/index.md',
  '# MemexAI Memory

`shared/` is read-only guidance for all agents. `user/` is each user''s private writable workspace.

## Shared files (always in context)

| File | Purpose |
|---|---|
| `shared/procedural.md` | How agents must behave — tool rules, write policy, what not to store |
| `shared/semantic.md` | Schema for user facts — what to write to `user/profile.md` |
| `shared/episodic.md` | Schema for user events — what to append to `user/log.md` |

## User memory layout

| File | What belongs here |
|---|---|
| `user/profile.md` | Stable facts about this user — preferences, constraints, goals |
| `user/log.md` | Time-ordered events — decisions, rejections, milestones (append-only) |
'
)
ON CONFLICT (physical_path) DO UPDATE
  SET content_text = EXCLUDED.content_text, updated_at = now();

-- 2. Seed shared/procedural.md — behavioral rules and tool policies.
INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_008_procedural',
  'shared/procedural.md',
  '# Agent Behavior Rules (Procedural Memory)

Follow these rules in every session.

## Memory write policy

- Use `memory_remember` to capture durable facts from user statements.
- Use `memory_patch` for small updates; prefer it over full rewrites.
- Never write one-off lookups (prices, hours, schedules) or raw conversation text.
- Never write personal health, financial, or legal inferences without confirmation.

## Tool selection guide

- Call `memory_context` before any personalized recommendation.
- Call `memory_patch` for field updates; `memory_write` only when creating a file or doing a full replacement.
- Call `memory_remember` whenever the user states a preference, constraint, or decision.

## HITL signal

Whenever a Human-in-the-Loop clarifying question is answered by the user, that answer is a strong candidate for memory. Capture it in `user/profile.md` (stable facts) or `user/log.md` (decisions and events).

## What NOT to memorize

- Transient statements ("I''m tired today", "I''m in a hurry")
- Questions the user is exploring, not deciding
- Anything the user asks to keep private
- Session artifacts that don''t affect future responses
'
)
ON CONFLICT (physical_path) DO UPDATE
  SET content_text = EXCLUDED.content_text, updated_at = now();

-- 3. Seed shared/semantic.md — schema for user facts stored in user/profile.md.
INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_008_semantic',
  'shared/semantic.md',
  '# Semantic Memory Schema

Semantic memory holds stable, deduplicated facts about the user — things that should persist and improve every future session.

## What belongs in `user/profile.md`

Store facts that are **stable, specific, and decision-relevant**:
- Stated preferences (soft, refinable — patch when the user updates them)
- Hard constraints (non-negotiable blockers — never override without explicit correction)
- Active goals with a time horizon

Format each fact as a single line with a timestamp: `- Prefers X [YYYY-MM]`

When patching, update the timestamp and remove the old line.

## What NOT to store

- One-off lookups (prices, hours, transit schedules)
- Raw conversation text or session summaries
- Transient searches or exploratory questions
- Anything the user explicitly said to forget

## Corrections

Patch the existing file. Do not leave old and new facts side by side.
- Wrong: `- Budget: 60L [2025-01]` AND `- Budget: 80L [2025-03]` (both present)
- Right: `- Budget: 80L [2025-03]` (old line removed)
'
)
ON CONFLICT (physical_path) DO UPDATE
  SET content_text = EXCLUDED.content_text, updated_at = now();

-- 4. Seed shared/episodic.md — schema for user events stored in user/log.md.
INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_008_episodic',
  'shared/episodic.md',
  '# Episodic Memory Schema

Episodic memory holds time-ordered events worth carrying forward — what happened, when, and why.

## What belongs in `user/log.md`

Log events that changed the user''s context or decision:
- Properties or options viewed and rejected (include the reason — it prevents re-suggesting the same option)
- Decisions made (booking, accepting, rejecting an offer)
- Goal milestones reached
- User corrections ("I changed my mind about X")

Format each entry as: `- [YYYY-MM] Event — reason if applicable`

## Append-only

Never patch or edit `user/log.md`. Only append new lines. Revisions track full history if rollback is needed.

## HITL signal

When a user answers a clarifying question that resolves ambiguity, log the decision if it represents a meaningful choice (not just a transient lookup).

## What NOT to log

- Transient lookups or exploratory questions
- Emotional venting with no durable outcome
- Information about other people the user mentioned
'
)
ON CONFLICT (physical_path) DO UPDATE
  SET content_text = EXCLUDED.content_text, updated_at = now();

-- 5. Remove shared/user-memory.md — its content has moved into shared/semantic.md and shared/episodic.md.
DELETE FROM mx_file WHERE physical_path = 'shared/user-memory.md';

-- 6. Update shared/domain.md with triad-aware example (ON CONFLICT DO UPDATE so existing customizations get refreshed).
INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_008_domain',
  'shared/domain.md',
  '# Domain Memory Guidance

Replace this file with memory categories specific to your product.
The travel assistant example below shows how the cognitive triad maps to real agent memory.

---

## Example: Travel Assistant

### Semantic — `user/profile.md`
Stable facts, refinable. Patch when the user updates them.

- Accommodation style: boutique / resort / hostel / chain
- Seat preference: window / aisle / no preference
- Travel pace: packed itinerary / relaxed / mix
- Companions: solo / couple / family / with pets
- Budget ceiling per night (e.g. `- Max $200/night [2025-01]`)
- Dietary restrictions or allergies

### Episodic — `user/log.md`
What happened. Append-only — never patch, only append.

- `- [2025-03] Booked Seminyak villa via Airbnb`
- `- [2025-01] Rejected Hotel X: too close to main road`
- `- [2025-04] Chose train over flight for Paris trip — preferred pace`

The rejection reason is the most valuable part. It prevents re-suggesting options the user has already ruled out.

---

## Judgment calls

| User says | Memory type | File | Action |
|---|---|---|---|
| "I usually prefer..." | Semantic | user/profile.md | Patch as preference |
| "I will never..." | Semantic | user/profile.md | Patch as hard constraint |
| "I tried X and hated it" | Episodic | user/log.md | Append with reason |
| "I''m planning to..." | Semantic | user/profile.md | Add as goal |
| "What''s the price of..." | None | — | Do not store — transient lookup |
| Answered a clarifying question | Semantic or Episodic | profile.md or log.md | Capture the resolved context |
'
)
ON CONFLICT (physical_path) DO UPDATE
  SET content_text = EXCLUDED.content_text, updated_at = now();
