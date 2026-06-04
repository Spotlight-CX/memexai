// The exact content of shared/index.md after a fresh migration (migration 004).
// If the live file matches this, the operator has not yet customized shared memory
// and the setup wizard should be shown.
export const SEED_SHARED_INDEX_MD = `# Memory System

\`shared/\` is operator-controlled context. \`user/\` is each user's writable workspace.

## Files in this shared space

- \`shared/user-memory.md\` — How agents should manage user memory.

## Spaces

- \`shared/\` — Operator rules and domain context. Read-only for agents.
- \`user/\` — User's personal memory workspace. Write freely.

## Quick rules

- Prefer \`memory_memorize\` and \`memory_search\` over raw file tools.
- Use \`memory_list\` before assuming what files exist under \`user/\`.
- Read \`user/index.md\` on first turn; infer structure if it doesn't exist.`
