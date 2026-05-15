WITH seed_files AS (
  SELECT *
  FROM (
    VALUES
      (
        'file_seed_shared_index',
        'shared/index.md',
        '# Shared Memory Index

`shared/` is read-only context managed by the operator. It is visible to every user and should contain product guidance, durable rules, and workspace-level context.

## Spaces

- `shared/` is global, read-only memory for all users.
- `user/` is each user''s writable memory workspace.

Use this file to orient agents before they read or write user-specific memory.'
      ),
      (
        'file_seed_demo_user_index',
        'users/demo_user/index.md',
        '# User Memory Index

This file is the starter index for the virtual `user/` workspace. Agents see this path as `user/index.md` when acting for `demo_user`.

## How to use user memory

- Store stable, durable facts in `user/`.
- Prefer clear topic files like `user/profile.md`, `user/preferences.md`, or `user/projects.md`.
- Update this index when adding important files or sections.

This starter file contains guidance only and no fake user preferences.'
      )
  ) AS seed(id, physical_path, content_text)
),
inserted_files AS (
  INSERT INTO mx_file (id, physical_path, content_text)
  SELECT id, physical_path, content_text
  FROM seed_files
  ON CONFLICT (physical_path) DO NOTHING
  RETURNING id, physical_path, content_text
),
inserted_revisions AS (
  INSERT INTO mx_revision (id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id)
  SELECT
    'rev_seed_003_' || regexp_replace(physical_path, '[^a-zA-Z0-9]+', '_', 'g'),
    id,
    physical_path,
    'write',
    content_text,
    'Baseline seed migration',
    'system',
    CASE
      WHEN physical_path = 'users/demo_user/index.md' THEN 'demo_user'
      ELSE NULL
    END,
    'seed_003_baseline'
  FROM inserted_files
  RETURNING file_id, physical_path, user_id
)
INSERT INTO mx_access_log (id, file_id, physical_path, operation, actor, user_id, tool_call_id)
SELECT
  'log_seed_003_' || regexp_replace(physical_path, '[^a-zA-Z0-9]+', '_', 'g'),
  file_id,
  physical_path,
  'write',
  'system',
  user_id,
  'seed_003_baseline'
FROM inserted_revisions;
