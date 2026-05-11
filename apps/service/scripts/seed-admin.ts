import { createPool } from "../src/db"
import { newId } from "../src/ids"
import { runMigrations } from "../src/migrations"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error("DATABASE_URL is required")
  process.exit(1)
}

type SeedFile = {
  physicalPath: string
  content: string
  actor: string
  userId: string | null
  reason: string
}

const files: SeedFile[] = [
  {
    physicalPath: "shared/index.md",
    content: [
      "# Memory System",
      "",
      "`shared/` is read-only product context. `user/` is your writable space.",
      "",
      "Neither has a required structure. Design whatever organization serves the task best.",
      "",
      "## Spaces",
      "",
      "- `shared/` — operator-controlled rules and context. Read-only for agents.",
      "- `user/` — your personal workspace. Write freely.",
      "",
      "## Designing your memory",
      "",
      "Think of `user/` like a personal filesystem. Use flat files, folders, agent-specific",
      "structures, or a single file — whatever makes future reads fast and writes precise.",
      "",
      "Examples that all work:",
      "- `user/facts.md` — everything in one file",
      "- `user/profile.md`, `user/search.md` — topic files",
      "- `user/agents/researcher.md` — agent-specific state",
      "- `user/skills/` — reusable skill definitions",
      "",
      "There is no required index and no required schema.",
      "",
      "## Writing guidelines",
      "",
      "- Use `list_files` before assuming what exists",
      "- Write stable facts — not raw conversation transcripts",
      "- Patch to update; avoid full overwrites when adding to a section",
      "- Terse beats verbose — one clear sentence over a paragraph",
    ].join("\n"),
    actor: "system",
    userId: null,
    reason: "Agent-first memory system: no prescribed structure",
  },
  {
    physicalPath: "users/user_123/index.md",
    content: [
      "# Memory Index",
      "",
      "Table of contents for this user's memory space.",
      "",
      "## Files",
      "",
      "- `user/profile.md` — stable buyer preferences and goals",
      "- `user/shortlist.md` — active and archived shortlisted properties",
      "- `user/preferences/` — detailed preference breakdowns by topic",
      "",
      "## Notes",
      "",
      "Update this index when adding a new file or major section.",
    ].join("\n"),
    actor: "assistant",
    userId: "user_123",
    reason: "Initialized user memory index",
  },
  {
    physicalPath: "users/user_123/profile.md",
    content: [
      "# Profile",
      "",
      "## Stable Preferences",
      "",
      "- Budget is around 2.5 Cr",
      "- Prefers quieter projects near good schools",
      "- Office commute anchor is Indiranagar",
    ].join("\n"),
    actor: "assistant",
    userId: "user_123",
    reason: "Captured stable buyer profile",
  },
  {
    physicalPath: "users/user_123/preferences/index.md",
    content: [
      "# Preferences Index",
      "",
      "Detailed preference files for this user.",
      "",
      "## Files",
      "",
      "- `user/preferences/commute.md` — commute constraints and office schedule",
    ].join("\n"),
    actor: "assistant",
    userId: "user_123",
    reason: "Initialized preferences index",
  },
  {
    physicalPath: "users/user_123/preferences/commute.md",
    content: [
      "# Commute Preferences",
      "",
      "- Peak commute target: under 45 minutes",
      "- Hybrid schedule: three office days per week",
      "- Avoids daily ORR bottlenecks when possible",
    ].join("\n"),
    actor: "assistant",
    userId: "user_123",
    reason: "Captured commute constraints",
  },
  {
    physicalPath: "users/user_123/shortlist.md",
    content: [
      "# Shortlist",
      "",
      "## Active",
      "",
      "- Prestige Lakeside Habitat",
      "- Assetz 63 Degree East",
    ].join("\n"),
    actor: "assistant",
    userId: "user_123",
    reason: "Created shortlist memory",
  },
  {
    physicalPath: "users/user_456/index.md",
    content: [
      "# Memory Index",
      "",
      "Table of contents for this user's memory space.",
      "",
      "## Files",
      "",
      "- `user/profile.md` — stable buyer preferences and goals",
      "- `user/preferences/` — detailed preference breakdowns by topic",
      "",
      "## Notes",
      "",
      "Update this index when adding a new file or major section.",
    ].join("\n"),
    actor: "assistant",
    userId: "user_456",
    reason: "Initialized user memory index",
  },
  {
    physicalPath: "users/user_456/profile.md",
    content: [
      "# Profile",
      "",
      "## Stable Preferences",
      "",
      "- Wants villa or row-house options",
      "- Budget range is 3.5 Cr to 4.5 Cr",
      "- Values airport access and lower density",
    ].join("\n"),
    actor: "assistant",
    userId: "user_456",
    reason: "Captured villa buyer profile",
  },
  {
    physicalPath: "users/user_456/preferences/index.md",
    content: [
      "# Preferences Index",
      "",
      "Detailed preference files for this user.",
      "",
      "## Files",
      "",
      "- `user/preferences/schools.md` — school catchment requirements",
    ].join("\n"),
    actor: "assistant",
    userId: "user_456",
    reason: "Initialized preferences index",
  },
  {
    physicalPath: "users/user_456/preferences/schools.md",
    content: [
      "# School Preferences",
      "",
      "- Needs strong primary school access",
      "- School commute should stay under 25 minutes",
    ].join("\n"),
    actor: "assistant",
    userId: "user_456",
    reason: "Captured school constraints",
  },
]

const accessEvents = [
  { physicalPath: "shared/index.md", operation: "read", actor: "assistant", userId: "user_123", toolCallId: "seed_call_read_shared_index" },
  { physicalPath: "users/user_123/index.md", operation: "read", actor: "assistant", userId: "user_123", toolCallId: "seed_call_read_user_index" },
  { physicalPath: "users/user_123/profile.md", operation: "read", actor: "assistant", userId: "user_123", toolCallId: "seed_call_read_profile" },
  { physicalPath: "users/user_123/preferences/commute.md", operation: "read", actor: "assistant", userId: "user_123", toolCallId: "seed_call_read_commute" },
  { physicalPath: "users/user_123/shortlist.md", operation: "patch", actor: "assistant", userId: "user_123", toolCallId: "seed_call_patch_shortlist" },
  { physicalPath: "shared/index.md", operation: "read", actor: "assistant", userId: "user_456", toolCallId: "seed_call_read_shared_index_456" },
  { physicalPath: "users/user_456/profile.md", operation: "write", actor: "assistant", userId: "user_456", toolCallId: "seed_call_write_profile" },
]

async function main() {
  const db = createPool(databaseUrl!)
  try {
    await runMigrations(db)

    for (const file of files) {
      const fileId = await upsertFile(db, file)
      await insertRevision(db, fileId, file)
      await insertAccessLog(db, {
        fileId,
        physicalPath: file.physicalPath,
        operation: "write",
        actor: file.actor,
        userId: file.userId,
        toolCallId: `seed_write_${file.physicalPath.replace(/[^a-zA-Z0-9]/g, "_")}`,
      })
    }

    for (const event of accessEvents) {
      const { rows } = await db.query<{ id: string }>("SELECT id FROM mx_file WHERE physical_path = $1", [event.physicalPath])
      await insertAccessLog(db, { fileId: rows[0]?.id ?? null, ...event })
    }

    console.log(`Seeded ${files.length} files and ${files.length + accessEvents.length} access events.`)
  } finally {
    await db.end()
  }
}

async function upsertFile(db: ReturnType<typeof createPool>, file: SeedFile) {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO mx_file (id, physical_path, content_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (physical_path)
     DO UPDATE SET content_text = EXCLUDED.content_text, updated_at = now()
     RETURNING id`,
    [newId("file"), file.physicalPath, file.content],
  )
  return rows[0].id
}

async function insertRevision(db: ReturnType<typeof createPool>, fileId: string, file: SeedFile) {
  await db.query(
    `INSERT INTO mx_revision (id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id)
     VALUES ($1, $2, $3, 'write', $4, $5, $6, $7, $8)`,
    [
      newId("rev"),
      fileId,
      file.physicalPath,
      file.content,
      file.reason,
      file.actor,
      file.userId,
      `seed_revision_${file.physicalPath.replace(/[^a-zA-Z0-9]/g, "_")}`,
    ],
  )
}

async function insertAccessLog(db: ReturnType<typeof createPool>, input: {
  fileId: string | null
  physicalPath: string
  operation: string
  actor: string
  userId: string | null
  toolCallId: string
}) {
  await db.query(
    `INSERT INTO mx_access_log (id, file_id, physical_path, operation, actor, user_id, tool_call_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [newId("log"), input.fileId, input.physicalPath, input.operation, input.actor, input.userId, input.toolCallId],
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
