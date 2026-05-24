type SetupFile = { path: string; content: string }

const USER_INFO_CATEGORY_LABELS: Record<string, string> = {
  "preferences": "Stated preferences and tastes",
  "constraints": "Hard constraints (what they won't accept)",
  "goals": "Goals and active intentions",
  "history": "Past activity and history",
  "context": "Personal context (lifestyle, family, etc.)",
}

export function handleSetupGenerate(input: {
  productDescription: string
  domain: string
  userInfoCategories: string[]
  extra?: string
}): { files: SetupFile[] } {
  const { productDescription, domain, userInfoCategories, extra } = input

  const categoryLines = userInfoCategories
    .map((cat) => `- ${USER_INFO_CATEGORY_LABELS[cat] ?? cat}`)
    .concat(extra?.trim() ? [`- ${extra.trim()}`] : [])

  const userMemoryContent = [
    "# User Memory Guide",
    "",
    `Defines how agents should manage user-level memory for: ${productDescription}`,
    "",
    "## What to memorize",
    "",
    "Store facts that are **stable, specific, and decision-relevant**:",
    ...categoryLines,
    "",
    "Do NOT memorize raw conversation text, one-time lookups, or things the user can easily re-state.",
    "",
    "## How to organize user memory",
    "",
    "Use `user/` like a personal filesystem. No required schema:",
    "- `user/index.md` — registry of what exists and what it covers",
    "- `user/profile.md` — identity, lifestyle, constraints",
    "- `user/<topic>.md` — domain-specific files as needed",
    "",
    "When creating a new file, add a one-line entry to `user/index.md`.",
    "",
    "## Format rules",
    "",
    "- Key-value or bullet style. Avoid prose.",
    "- Patch to update; don't overwrite a file for a single fact.",
    "- State the fact, not the conversation.",
    "",
    "## Conflict resolution",
    "",
    "If a new fact contradicts a stored one, patch — replace, and note the change if useful.",
  ].join("\n")

  const domainContent = [
    `# ${domain} Context`,
    "",
    `This workspace is configured for: ${productDescription}`,
    "",
    "## User memory categories",
    "",
    ...categoryLines,
    "",
    "## Notes",
    "",
    "Update this file via the Configure tab as your product evolves.",
  ].join("\n")

  const indexContent = [
    "# Memory System",
    "",
    "`shared/` is operator-controlled context. `user/` is each user's writable workspace.",
    "",
    "## Files in this shared space",
    "",
    `- \`shared/user-memory.md\` — How agents should manage user memory for ${productDescription}.`,
    `- \`shared/domain.md\` — ${domain} domain context and user memory categories.`,
    "",
    "## Spaces",
    "",
    "- `shared/` — Operator rules and domain context. Read-only for agents.",
    "- `user/` — User's personal memory workspace. Write freely.",
    "",
    "## Quick rules",
    "",
    "- Prefer `memory_memorize` and `memory_search` over raw file tools.",
    "- Use `memory_list` before assuming what files exist under `user/`.",
    "- Read `user/index.md` on first turn; infer structure if it doesn't exist.",
  ].join("\n")

  return {
    files: [
      { path: "shared/index.md", content: indexContent },
      { path: "shared/user-memory.md", content: userMemoryContent },
      { path: "shared/domain.md", content: domainContent },
    ],
  }
}
