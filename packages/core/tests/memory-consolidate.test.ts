import { describe, expect, test, vi } from "vitest"

const generateTextMock = vi.fn()

vi.mock("ai", () => ({
  generateText: generateTextMock,
  jsonSchema: (schema: unknown) => schema,
  stepCountIs: (count: number) => ({ count }),
}))

const { executeMemoryConsolidate } = await import("../src/tools")

const updatedAt = new Date("2026-05-14T12:00:00.000Z")

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

function fileRow(physicalPath: unknown, content: string) {
  return {
    id: `file_${String(physicalPath).replace(/\W/g, "_")}`,
    physical_path: String(physicalPath),
    content_text: content,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
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
})
