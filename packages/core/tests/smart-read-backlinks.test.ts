import { describe, expect, test, vi } from "vitest"
import { executeMemorySmartRead } from "../src/tools"

function fileRow(physicalPath: string, content: string, updatedAt?: Date) {
  const date = updatedAt ?? new Date("2026-01-01T00:00:00Z")
  return {
    id: `file_${physicalPath.replace(/\//g, "_")}`,
    physical_path: physicalPath,
    content_text: content,
    created_at: date,
    updated_at: date,
  }
}

function seedRow(physicalPath: string, content: string, rank: number, updatedAt?: Date) {
  return { ...fileRow(physicalPath, content, updatedAt), rank }
}

function backlinkRow(sourcePath: string, targetPath: string) {
  return { source_path: sourcePath, target_path: targetPath }
}

function createMockDb(
  files: ReturnType<typeof fileRow>[],
  backlinks: ReturnType<typeof backlinkRow>[] = [],
) {
  return {
    query: vi.fn(async (sql: string, values: unknown[] = []) => {
      if (sql.includes("mx_access_log")) return { rows: [] }

      if (sql.includes("search_vector @@ q.query")) {
        return { rows: files.filter((f) => "rank" in f) }
      }

      // Backlink reverse lookup — must come before physical_path = ANY check
      if (sql.includes("FROM mx_backlink") && sql.includes("target_path = ANY")) {
        const targetPaths = values[0] as string[]
        return { rows: backlinks.filter((b) => targetPaths.includes(b.target_path)) }
      }

      if (sql.includes("physical_path = ANY")) {
        const paths = values[0] as string[]
        return { rows: files.filter((f) => paths.includes(f.physical_path)) }
      }

      return { rows: [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

const CTX = { userId: "u1" }

// ---------------------------------------------------------------------------
// GOLDEN PATH TEST
// ---------------------------------------------------------------------------

describe("memory_smart_read — bidirectional backlinks golden path", () => {
  test("hub + inbound visit notes + forward-linked files in correct order", async () => {
    const files = [
      // Hub — BM25 seed
      seedRow(
        "users/u1/preferences.md",
        "# Apartment Preferences\n- 2BHK, Whitefield area\n- See also: [[user/profile.md]], [[shared/index.md]]",
        0.95,
        new Date("2026-01-15T00:00:00Z"),
      ),
      // Forward-linked from preferences.md
      fileRow("users/u1/profile.md", "# Profile\nSooraj", new Date("2026-01-01T00:00:00Z")),
      fileRow("shared/index.md", "# Shared index", new Date("2026-01-01T00:00:00Z")),
      // Inbound visit notes — link TO preferences.md
      fileRow(
        "users/u1/visits/jan-15.md",
        "# Site Visit\nConfirmed [[user/preferences.md]] — 2BHK target.",
        new Date("2026-01-15T00:00:00Z"),
      ),
      fileRow(
        "users/u1/visits/feb-03.md",
        "# Viewing notes\n[[user/preferences.md]] still holds. Dislikes high-rises.",
        new Date("2026-02-03T00:00:00Z"),
      ),
      fileRow(
        "users/u1/visits/mar-20.md",
        "# Call summary\nUpdated [[user/preferences.md]]: wants ground floor after knee injury.",
        new Date("2026-03-20T00:00:00Z"),
      ),
    ]

    const backlinks = [
      backlinkRow("users/u1/visits/jan-15.md", "users/u1/preferences.md"),
      backlinkRow("users/u1/visits/feb-03.md", "users/u1/preferences.md"),
      backlinkRow("users/u1/visits/mar-20.md", "users/u1/preferences.md"),
    ]

    const db = createMockDb(files, backlinks)
    const result = await executeMemorySmartRead(db, { query: "apartment preferences", maxChars: 40_000 }, CTX)

    // 1. All 6 files included, nothing omitted
    expect(result.filesIncluded).toHaveLength(6)
    expect(result.filesOmitted).toHaveLength(0)
    expect(result.truncated).toBe(false)

    // 2. Hub is first
    expect(result.filesIncluded[0]).toBe("user/preferences.md")

    const marIdx  = result.filesIncluded.indexOf("user/visits/mar-20.md")
    const febIdx  = result.filesIncluded.indexOf("user/visits/feb-03.md")
    const janIdx  = result.filesIncluded.indexOf("user/visits/jan-15.md")
    const profIdx = result.filesIncluded.indexOf("user/profile.md")
    const shIdx   = result.filesIncluded.indexOf("shared/index.md")

    // 3. All inbound files present
    expect(marIdx).toBeGreaterThan(0)
    expect(febIdx).toBeGreaterThan(0)
    expect(janIdx).toBeGreaterThan(0)

    // 4. Inbound files rank before forward-linked files
    expect(marIdx).toBeLessThan(profIdx)
    expect(febIdx).toBeLessThan(profIdx)
    expect(janIdx).toBeLessThan(profIdx)
    expect(marIdx).toBeLessThan(shIdx)

    // 5. Most recent inbound (mar-20) ranks first among inbound
    expect(marIdx).toBeLessThan(febIdx)
    expect(febIdx).toBeLessThan(janIdx)

    // 6. Correct metadata for hub
    const hubMeta = result.filesIncludedMeta.find((m) => m.path === "user/preferences.md")!
    expect(hubMeta.reason).toBe("query_match")
    expect(hubMeta.depth).toBe(0)
    expect(hubMeta.linkedFrom).toBeUndefined()

    // 7. Correct metadata for inbound file
    const marMeta = result.filesIncludedMeta.find((m) => m.path === "user/visits/mar-20.md")!
    expect(marMeta.reason).toBe("inbound_link")
    expect(marMeta.depth).toBe(1)
    expect(marMeta.linkedFrom).toBe("user/preferences.md")

    // 8. Correct metadata for forward-linked file
    const profMeta = result.filesIncludedMeta.find((m) => m.path === "user/profile.md")!
    expect(profMeta.reason).toBe("linked")
    expect(profMeta.depth).toBe(1)

    // 9. Content contains all sections with key text
    expect(result.content).toContain("## user/preferences.md")
    expect(result.content).toContain("## user/visits/mar-20.md")
    expect(result.content).toContain("ground floor after knee injury")
    expect(result.content).toContain("## user/visits/feb-03.md")
    expect(result.content).toContain("## user/visits/jan-15.md")
    expect(result.content).toContain("## user/profile.md")
    expect(result.content).toContain("## shared/index.md")

    // 10. Physical paths never leak through virtual translation
    expect(result.content).not.toContain("users/u1")
  })
})

// ---------------------------------------------------------------------------
// EDGE CASES
// ---------------------------------------------------------------------------

describe("backward expansion edge cases", () => {
  test("no backlinks → identical to current behaviour (only seeds + forward links)", async () => {
    const files = [
      seedRow("users/u1/preferences.md", "# Prefs\n[[user/profile.md]]", 0.9),
      fileRow("users/u1/profile.md", "# Profile"),
    ]
    const db = createMockDb(files, [])
    const result = await executeMemorySmartRead(db, { query: "preferences", maxChars: 40_000 }, CTX)

    expect(result.filesIncluded).toEqual(["user/preferences.md", "user/profile.md"])
    const reasons = result.filesIncludedMeta.map((m) => m.reason)
    expect(reasons).not.toContain("inbound_link")
  })

  test("inbound file already found via forward traversal is not duplicated", async () => {
    // A → B (forward), C → A (backward, C also found in BM25)
    const files = [
      seedRow("users/u1/a.md", "# A\n[[user/b.md]]", 0.9),
      seedRow("users/u1/b.md", "# B — links to A too\n[[user/a.md]]", 0.5),
    ]
    const backlinks = [backlinkRow("users/u1/b.md", "users/u1/a.md")]
    const db = createMockDb(files, backlinks)
    const result = await executeMemorySmartRead(db, { query: "test", maxChars: 40_000 }, CTX)

    // b.md should appear exactly once
    expect(result.filesIncluded.filter((p) => p === "user/b.md")).toHaveLength(1)
  })

  test("character budget respected — inbound files omitted when over budget", async () => {
    const hub = seedRow("users/u1/hub.md", "# Hub", 0.9)
    const bigContent = "x".repeat(2000)
    const inboundFiles = Array.from({ length: 5 }, (_, i) =>
      fileRow(`users/u1/note-${i}.md`, bigContent),
    )
    const backlinks = inboundFiles.map((f) =>
      backlinkRow(f.physical_path, "users/u1/hub.md"),
    )

    const db = createMockDb([hub, ...inboundFiles], backlinks)
    // Budget only fits hub + 1 inbound
    const result = await executeMemorySmartRead(db, { query: "test", maxChars: 2200 }, CTX)

    expect(result.filesIncluded[0]).toBe("user/hub.md")
    expect(result.truncated).toBe(true)
    expect(result.filesOmitted.length).toBeGreaterThan(0)
  })

  test("backward expansion does not recurse (only depth-0 seeds expand inbound)", async () => {
    // A ← B ← C  (C links to B, B links to A)
    const files = [
      seedRow("users/u1/a.md", "# A", 0.9),
      fileRow("users/u1/b.md", "# B"),
      fileRow("users/u1/c.md", "# C"),
    ]
    const backlinks = [
      backlinkRow("users/u1/b.md", "users/u1/a.md"),  // B links TO A
      backlinkRow("users/u1/c.md", "users/u1/b.md"),  // C links TO B
    ]
    const db = createMockDb(files, backlinks)
    const result = await executeMemorySmartRead(db, { query: "test", maxChars: 40_000 }, CTX)

    // A is seed, B is inbound to A, C is inbound to B (not A) — C should NOT appear
    expect(result.filesIncluded).toContain("user/a.md")
    expect(result.filesIncluded).toContain("user/b.md")
    expect(result.filesIncluded).not.toContain("user/c.md")
  })

  test("circular A→B, B→A — terminates, both included once", async () => {
    const files = [
      seedRow("users/u1/a.md", "# A\n[[user/b.md]]", 0.9),
      fileRow("users/u1/b.md", "# B\n[[user/a.md]]"),
    ]
    // B links back to A
    const backlinks = [backlinkRow("users/u1/b.md", "users/u1/a.md")]
    const db = createMockDb(files, backlinks)
    const result = await executeMemorySmartRead(db, { query: "test", maxChars: 40_000 }, CTX)

    expect(result.filesIncluded.filter((p) => p === "user/a.md")).toHaveLength(1)
    expect(result.filesIncluded.filter((p) => p === "user/b.md")).toHaveLength(1)
  })

  test("forward traversal still works independently", async () => {
    const files = [
      seedRow("users/u1/a.md", "# A\n[[user/b.md]]", 0.9),
      fileRow("users/u1/b.md", "# B\n[[user/c.md]]"),
      fileRow("users/u1/c.md", "# C"),
    ]
    // No backlinks
    const db = createMockDb(files, [])
    const result = await executeMemorySmartRead(db, { query: "test", maxChars: 40_000, relatedDepth: 2 }, CTX)

    expect(result.filesIncluded).toContain("user/a.md")
    expect(result.filesIncluded).toContain("user/b.md")
    expect(result.filesIncluded).toContain("user/c.md")
  })
})
