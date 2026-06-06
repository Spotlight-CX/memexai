-- Upgrade shared/index.md to the richer taxonomy-aware seed.
-- Skips customized setups that already contain a taxonomy section.
UPDATE mx_file
SET content_text = '# MemexAI Memory

`shared/` is read-only guidance for all agents. `user/` is each user''s private writable workspace.

## Shared files

- `shared/user-memory.md` — rules for what to store, patch, and ignore
- `shared/domain.md` — product-specific memory categories and examples

## Expected user files

| File | What belongs here |
|---|---|
| `user/index.md` | Registry of all user files and what they cover |
| `user/preferences.md` | Durable soft preferences — refinable over time |
| `user/constraints.md` | Hard blockers — budget ceilings, allergies, banned options |
| `user/goals.md` | Active intentions — mark completed when resolved |
| `user/history.md` | Key events and decisions — append-only |

## Memory taxonomy

- **Preference** — soft, refinable. Patch when updated. `- Prefers boutique hotels [2025-01]`
- **Constraint** — hard blocker. Never override without explicit correction. `- No peanuts (allergy) [2025-01]`
- **Goal** — time-bound. Mark done when resolved. `- Trip to Bali, Q3 2025 [open]`
- **Episode** — what happened. Append to `history.md` only; never patch. `- Booked Seminyak villa [2025-03]`

## Timestamp convention

Append `[YYYY-MM]` when writing a fact. Update the timestamp when patching. This is the only recency signal — revisions track file-level history, not line-level.

## What NOT to store

- One-off lookups (prices, hours, transit schedules)
- Emotional venting with no durable signal
- Information about other people the user mentioned
',
    updated_at = now()
WHERE physical_path = 'shared/index.md'
  AND content_text NOT LIKE '%Memory taxonomy%';

-- Upgrade shared/user-memory.md with timestamp convention and correction examples.
UPDATE mx_file
SET content_text = '# User Memory Rules

## What to store

Store facts that are **stable, specific, and decision-relevant**:
- Stated preferences (soft, refinable — patch when the user updates them)
- Hard constraints (blockers — treat as immovable until explicitly corrected)
- Active goals with a time horizon (mark done when resolved)
- Key decisions or events worth carrying forward

## What NOT to store

- One-off lookups the user can easily re-ask (prices, hours, schedules)
- Raw conversation text or session summaries
- Transient searches or exploratory questions
- Anything the user explicitly said to forget

## How to organize user memory

Each user gets a private `user/` namespace. Suggested layout:
- `user/index.md` — one-line registry of what files exist
- `user/preferences.md` — soft preferences, patchable
- `user/constraints.md` — hard rules, high-priority
- `user/goals.md` — active intentions, mark done when resolved
- `user/history.md` — key events, append-only

Create `user/<topic>.md` for domain-specific clusters as needed.

## Timestamp convention

When writing a new fact, append the month learned: `- Prefers X [YYYY-MM]`.
When patching, update the timestamp to the current month.
This is the only recency signal — `mx_revision` tracks file-level history, not line-level.

## Corrections

Patch the existing file. Do not leave the old fact alongside the new one.
- Wrong: `- Prefers boutique hotels [2025-01]` and `- Prefers city hotels [2025-03]` (both present)
- Right: `- Prefers city hotels [2025-03]` (old line removed)
',
    updated_at = now()
WHERE physical_path = 'shared/user-memory.md'
  AND content_text NOT LIKE '%Timestamp convention%';

-- Seed shared/domain.md for the first time with a travel-assistant example.
INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_008_domain',
  'shared/domain.md',
  '# Domain Memory Guidance

Replace this file with memory categories specific to your product.
The travel assistant example below shows all four memory types in practice.

---

## Example: Travel Assistant

### Preferences (`user/preferences.md`)
Soft facts, refinable. Patch when the user updates them.

- Accommodation style: boutique / resort / hostel / chain
- Seat preference: window / aisle / no preference
- Travel pace: packed itinerary / relaxed / mix
- Companions: solo / couple / family / with pets

### Constraints (`user/constraints.md`)
Hard blockers. Never override without explicit correction.

- Budget ceiling per night (e.g. `- Max $200/night [2025-01]`)
- Pet-friendly required
- Dietary restrictions or allergies
- Accessibility requirements
- Brands or hotel chains to avoid

### Goals (`user/goals.md`)
Active intentions with a time horizon. Mark `[done]` when resolved.

- `- Trip to Bali, Q3 2025 [open]`
- `- Weekend city break, budget £300 total [open]`
- `- Anniversary trip to Paris, June 2025 [booked]`

### Episodes (`user/history.md`)
What happened. Append-only — never patch, only append.

- `- Booked Seminyak villa via Airbnb [2025-03]`
- `- Rejected Hotel X: too close to main road [2025-01]`
- `- Chose train over flight for Paris trip — preferred pace [2025-04]`

The rejection reason is the most valuable part of an episode.
It prevents re-suggesting options the user has already ruled out.

---

## Judgment calls

| User says | Memory type | Action |
|---|---|---|
| "I usually prefer..." | Preference | Store in preferences.md |
| "I will never..." | Constraint | Store in constraints.md |
| "I''m planning to..." | Goal | Store in goals.md with status `[open]` |
| "I tried X and hated it" | Episode | Append to history.md with reason |
| "What''s the price of..." | None | Do not store — transient lookup |
'
)
ON CONFLICT (physical_path) DO NOTHING;
