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

const now = new Date()

const files: SeedFile[] = [
  {
    physicalPath: "shared/index.md",
    content: [
      "# Shared Memory Guide",
      "",
      "- `shared/claude.md` contains product-wide memory rules.",
      "- `user/**` contains writable user memory.",
      "- Prefer concise, stable facts over noisy transcripts.",
    ].join("\n"),
    actor: "system",
    userId: null,
    reason: "Seed shared index",
  },
  {
    physicalPath: "shared/claude.md",
    content: [
      "# Agent Instructions",
      "",
      "Use MemexAI memory to preserve stable user preferences.",
      "Never write to shared memory from agent tool calls.",
    ].join("\n"),
    actor: "system",
    userId: null,
    reason: "Seed shared agent guidance",
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
  { physicalPath: "users/user_123/profile.md", operation: "read", actor: "assistant", userId: "user_123", toolCallId: "seed_call_read_profile" },
  { physicalPath: "users/user_123/preferences/commute.md", operation: "read", actor: "assistant", userId: "user_123", toolCallId: "seed_call_read_commute" },
  { physicalPath: "users/user_123/shortlist.md", operation: "patch", actor: "assistant", userId: "user_123", toolCallId: "seed_call_patch_shortlist" },
  { physicalPath: "shared/claude.md", operation: "read", actor: "assistant", userId: "user_456", toolCallId: "seed_call_read_shared" },
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
