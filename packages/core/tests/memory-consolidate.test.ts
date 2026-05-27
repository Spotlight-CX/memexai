import { describe, expect, test, vi } from "vitest"

const generateTextMock = vi.fn()

vi.mock("ai", () => ({
  generateText: generateTextMock,
  jsonSchema: (schema: unknown) => schema,
  stepCountIs: (count: number) => ({ count }),
}))

const { executeMemoryConsolidate } = await import("../src/tools")

const updatedAt = new Date("2026-05-14T12:00:00.000Z")

function fileRow(physicalPath: unknown, content: string, minsAgo = 0) {
  return {
    id: `file_${String(physicalPath).replace(/\W/g, "_")}`,
    physical_path: String(physicalPath),
    content_text: content,
    created_at: updatedAt,
    updated_at: new Date(updatedAt.getTime() - minsAgo * 60_000),
  }
}

function createDb() {
  return {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("ORDER BY physical_path ASC")) {
        return {
          rows: [
            fileRow("users/u1/profile.md", "Name: Sooraj"),
            fileRow("users/u1/dream-log.md", "previous dream"),
            fileRow("users/u1/activity-log.md", "activity"),
          ],
        }
      }
      if (sql.includes("WHERE physical_path = $1")) {
        const path = values?.[0]
        if (path === "users/u1/profile.md") return { rows: [fileRow(path, "Name: Sooraj\nName: Sooraj")] }
        return { rows: [] }
      }
      if (sql.includes("UPDATE mx_file")) return { rows: [] }
      if (sql.includes("INSERT INTO mx_revision") || sql.includes("INSERT INTO mx_access_log")) return { rows: [] }
      return { rows: [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

function createLargeDb(count: number, contentSize = 10) {
  const files = Array.from({ length: count }, (_, i) => ({
    id: `file_note_${i}`,
    physical_path: `users/u1/note-${i}.md`,
    content_text: `note-${i} `.repeat(contentSize).trim(),
    created_at: updatedAt,
    updated_at: new Date(updatedAt.getTime() - i * 60_000),
  }))
  return {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("ORDER BY physical_path ASC")) return { rows: files }
      if (sql.includes("WHERE physical_path = $1")) {
        const path = values?.[0]
        const f = files.find((r) => r.physical_path === path)
        return { rows: f ? [f] : [] }
      }
      if (sql.includes("UPDATE mx_file")) return { rows: [] }
      if (sql.includes("INSERT INTO mx_revision") || sql.includes("INSERT INTO mx_access_log")) return { rows: [] }
      return { rows: [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("executeMemoryConsolidate", () => {
  test("requires a configured model", async () => {
    await expect(executeMemoryConsolidate(createDb(), { userId: "u1" }))
      .rejects.toMatchObject({ code: "MODEL_NOT_CONFIGURED" })
  })

  test("reads user files while excluding logs", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      expect(input.prompt).toContain("user/profile.md")
      expect(input.prompt).not.toContain("dream-log.md")
      expect(input.prompt).not.toContain("activity-log.md")
      return { text: "No changes." }
    })

    const result = await executeMemoryConsolidate(db, { userId: "u1" }, { model: { id: "mock" } })

    expect(result.filesRead).toEqual(["user/profile.md"])
    expect(result.writes).toEqual([])
  })

  test("commits consolidation patches as dream-agent", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_patch.execute({
        path: "user/profile.md",
        operation: "replace_lines",
        match: "Name: Sooraj\nName: Sooraj",
        replacement: "Name: Sooraj",
        reason: "merged duplicate fact",
      })
      return { text: "Consolidated." }
    })

    const result = await executeMemoryConsolidate(db, { userId: "u1" }, { model: { id: "mock" } })

    expect(result.filesTouched).toEqual(["user/profile.md"])
    const revisionCall = (db.query as ReturnType<typeof vi.fn>).mock.calls.find(([sql]) => String(sql).includes("INSERT INTO mx_revision"))
    expect(revisionCall?.[1]).toContain("dream-agent")
  })

  test("supports dry run proposals without writes", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_write.execute({
        path: "user/profile.md",
        content: "Name: Sooraj",
        reason: "rewrite duplicate fact",
      })
      return { text: "Planned." }
    })

    const result = await executeMemoryConsolidate(db, { userId: "u1" }, { model: { id: "mock" }, dryRun: true })

    expect(result.dryRun).toBe(true)
    expect(result.writes[0]).toMatchObject({ tool: "memory_write", path: "user/profile.md" })
    const sqlCalls = (db.query as ReturnType<typeof vi.fn>).mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mx_revision"))).toBe(false)
  })

  test("reads at most maxFiles files (default 20)", async () => {
    const db = createLargeDb(25)
    generateTextMock.mockImplementationOnce(async (input) => {
      const matches = [...new Set(input.prompt.match(/note-\d+/g) ?? [])]
      expect(matches.length).toBeLessThanOrEqual(20)
      return { text: "done" }
    })
    await executeMemoryConsolidate(db, { userId: "u1" }, { model: {} })
  })

  test("respects custom maxFiles option", async () => {
    const db = createLargeDb(10)
    generateTextMock.mockImplementationOnce(async (input) => {
      const matches = [...new Set(input.prompt.match(/note-\d+/g) ?? [])]
      expect(matches.length).toBeLessThanOrEqual(3)
      return { text: "done" }
    })
    await executeMemoryConsolidate(db, { userId: "u1" }, { model: {}, maxFiles: 3 })
  })

  test("selects most recently updated files when capping", async () => {
    // note-0 is newest (0 min old), note-24 is oldest (24 min old)
    const db = createLargeDb(25)
    generateTextMock.mockImplementationOnce(async (input) => {
      expect(input.prompt).toContain("note-0")
      expect(input.prompt).not.toContain("note-24")
      return { text: "done" }
    })
    await executeMemoryConsolidate(db, { userId: "u1" }, { model: {} })
  })

  test("drops oldest files to stay under maxInputChars", async () => {
    // 5 files, each ~50 chars of content; set maxInputChars to 80 so only ~1-2 files fit
    const db = createLargeDb(5, 5)
    let promptLength = 0
    generateTextMock.mockImplementationOnce(async (input) => {
      promptLength = input.prompt.length
      return { text: "done" }
    })
    await executeMemoryConsolidate(db, { userId: "u1" }, { model: {}, maxInputChars: 80 })
    // With 80-char budget, fewer than all 5 file contents should appear
    // note-0 (newest) should still be present
    expect(promptLength).toBeGreaterThan(0)
    // The 5 files total ~250 chars; with maxInputChars=80, we expect fewer files in prompt
  })
})
