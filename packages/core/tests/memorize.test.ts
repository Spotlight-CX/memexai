import { describe, expect, test, vi } from "vitest"

const generateTextMock = vi.fn()

vi.mock("ai", () => ({
  generateText: generateTextMock,
  jsonSchema: (schema: unknown) => schema,
  stepCountIs: (count: number) => ({ count }),
}))

const { executeMemoryMemorize } = await import("../src/tools")

const updatedAt = new Date("2026-05-14T12:00:00.000Z")

const LOG_CONTENT = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join("\n")

function fileRow(physicalPath: string, content: string) {
  return {
    id: `file_${physicalPath.replace(/\W/g, "_")}`,
    physical_path: physicalPath,
    content_text: content,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
}

function createDb() {
  return {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("ORDER BY physical_path ASC")) {
        return {
          rows: [
            fileRow("users/u1/profile.md", "# Profile"),
            fileRow("users/u1/log.md", LOG_CONTENT),
          ],
        }
      }
      if (sql.includes("WHERE physical_path = $1")) {
        const path = values?.[0]
        if (path === "users/u1/profile.md") return { rows: [fileRow("users/u1/profile.md", "# Profile")] }
        if (path === "users/u1/log.md") return { rows: [fileRow("users/u1/log.md", LOG_CONTENT)] }
        return { rows: [] }
      }
      if (sql.includes("INSERT INTO mx_file")) {
        return { rows: [{ id: "file_profile", created: true }] }
      }
      if (sql.includes("mx_revision") || sql.includes("mx_access_log")) return { rows: [] }
      return { rows: [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("executeMemoryMemorize", () => {
  test("requires a configured model", async () => {
    await expect(executeMemoryMemorize(
      createDb(),
      { text: "remember quiet neighborhoods" },
      { userId: "u1" },
    )).rejects.toMatchObject({ code: "MODEL_NOT_CONFIGURED" })
  })

  test("supports dry run without SQL writes", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_write.execute({
        path: "user/profile.md",
        content: "# Profile",
        reason: "captured preference",
      })
      return { text: "Planned." }
    })

    const result = await executeMemoryMemorize(
      db,
      { text: "remember quiet neighborhoods", dryRun: true },
      { userId: "u1" },
      { model: { id: "mock-model" } },
    )

    expect(result.dryRun).toBe(true)
    expect(result.writes).toMatchObject([{ tool: "memory_write", path: "user/profile.md", reason: "captured preference" }])
    const sqlCalls = (db.query as ReturnType<typeof vi.fn>).mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mx_file"))).toBe(false)
    expect(sqlCalls.some((sql) => sql.includes("mx_revision"))).toBe(false)
  })

  test("commits writes through normal write path", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_write.execute({
        path: "user/profile.md",
        content: "# Profile",
        reason: "captured preference",
      })
      return { text: "Remembered." }
    })

    const result = await executeMemoryMemorize(
      db,
      { text: "remember quiet neighborhoods" },
      { userId: "u1", actor: "assistant" },
      { model: { id: "mock-model" } },
    )

    expect(result.writes[0]?.result).toMatchObject({ path: "user/profile.md", created: true })
    const sqlCalls = (db.query as ReturnType<typeof vi.fn>).mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mx_file"))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mx_revision"))).toBe(true)
    expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mx_access_log"))).toBe(true)
  })

  test("rejects shared writes from the inner model", async () => {
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_write.execute({
        path: "shared/profile.md",
        content: "# Nope",
      })
      return { text: "bad" }
    })

    await expect(executeMemoryMemorize(
      createDb(),
      { text: "remember quiet neighborhoods" },
      { userId: "u1" },
      { model: { id: "mock-model" } },
    )).rejects.toMatchObject({ code: "READ_ONLY_MOUNT" })
  })

  test("enforces maxWrites", async () => {
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_write.execute({ path: "user/a.md", content: "a" })
      await input.tools.memory_write.execute({ path: "user/b.md", content: "b" })
      return { text: "bad" }
    })

    await expect(executeMemoryMemorize(
      createDb(),
      { text: "remember quiet neighborhoods", maxWrites: 1 },
      { userId: "u1" },
      { model: { id: "mock-model" } },
    )).rejects.toMatchObject({ code: "MAX_WRITES_EXCEEDED" })
  })

  test("exposes memory_read tool to inner model by default", async () => {
    generateTextMock.mockImplementationOnce(async (input) => {
      expect(input.tools).toHaveProperty("memory_read")
      return { text: "done" }
    })
    await executeMemoryMemorize(createDb(), { text: "test" }, { userId: "u1" }, { model: {} })
  })

  test("model can call memory_read before patching", async () => {
    const db = createDb()
    generateTextMock.mockImplementationOnce(async (input) => {
      const file = await input.tools.memory_read.execute({ path: "user/profile.md" })
      expect(file.content).toBe("# Profile")
      return { text: "read it" }
    })
    await executeMemoryMemorize(db, { text: "test" }, { userId: "u1" }, { model: {} })
    const sqlCalls = (db.query as ReturnType<typeof vi.fn>).mock.calls.map(([sql]) => String(sql))
    expect(sqlCalls.some((s) => s.includes("WHERE physical_path = $1"))).toBe(true)
  })

  test("enforces maxReads budget", async () => {
    generateTextMock.mockImplementationOnce(async (input) => {
      await input.tools.memory_read.execute({ path: "user/profile.md" })
      await input.tools.memory_read.execute({ path: "user/notes.md" })
      return { text: "bad" }
    })
    await expect(
      executeMemoryMemorize(createDb(), { text: "test", maxReads: 1 }, { userId: "u1" }, { model: {} }),
    ).rejects.toMatchObject({ code: "MAX_READS_EXCEEDED" })
  })

  test("maxReads 0 omits memory_read from inner model tools", async () => {
    generateTextMock.mockImplementationOnce(async (input) => {
      expect(input.tools).not.toHaveProperty("memory_read")
      return { text: "done" }
    })
    await executeMemoryMemorize(createDb(), { text: "test", maxReads: 0 }, { userId: "u1" }, { model: {} })
  })

  test("log files are excluded from the regular file list in the prompt", async () => {
    generateTextMock.mockImplementationOnce(async (input) => {
      // log.md must NOT appear as a regular file entry
      expect(input.prompt).not.toMatch(/"path":\s*"user\/log\.md"/)
      // but the preview section must be present
      expect(input.prompt).toContain("Log file previews")
      return { text: "done" }
    })
    await executeMemoryMemorize(createDb(), { text: "test" }, { userId: "u1" }, { model: {} })
  })

  test("injects only the last 15 lines of a log file as preview", async () => {
    // LOG_CONTENT has 20 lines: line1..line20. Last 15 are line6..line20.
    generateTextMock.mockImplementationOnce(async (input) => {
      expect(input.prompt).toContain("line6")
      expect(input.prompt).toContain("line20")
      expect(input.prompt).not.toContain("line1\n")
      expect(input.prompt).not.toContain("line5\n")
      return { text: "done" }
    })
    await executeMemoryMemorize(createDb(), { text: "test" }, { userId: "u1" }, { model: {} })
  })
})
