UPDATE mx_file
SET content_text = '# Memory System

`shared/` is operator-controlled context. `user/` is each user''s writable workspace.

## Files in this shared space

- `shared/user-memory.md` — How agents should manage user memory.

## Spaces

- `shared/` — Operator rules and domain context. Read-only for agents.
- `user/` — User''s personal memory workspace. Write freely.

## Quick rules

- Prefer `memory_memorize` and `memory_search` over raw file tools.
- Use `memory_list` before assuming what files exist under `user/`.
- Read `user/index.md` on first turn; infer structure if it doesn''t exist.',
    updated_at = now()
WHERE physical_path = 'shared/index.md'
  AND length(content_text) < 300;

INSERT INTO mx_file (id, physical_path, content_text)
VALUES (
  'file_seed_004_user_memory',
  'shared/user-memory.md',
  '# User Memory Guide

Defines how agents should manage user-level memory in this workspace.

## What to memorize

Store facts that are **stable, specific, and decision-relevant**:
- Stated preferences and constraints
- Corrections with context
- Decisions and their reasoning

Do NOT memorize raw conversation text, one-time lookups, or things the user can easily re-state.

## How to organize user memory

Use `user/` like a personal filesystem. No required schema:
- `user/index.md` — registry of what exists and what it covers
- `user/profile.md` — identity, lifestyle, constraints
- `user/<topic>.md` — domain-specific files as needed

When creating a new file, add a one-line entry to `user/index.md`.

## Format rules

- Key-value or bullet style. Avoid prose.
- Patch to update; don''t overwrite a file for a single fact.
- State the fact, not the conversation.'
)
ON CONFLICT (physical_path) DO NOTHING;
