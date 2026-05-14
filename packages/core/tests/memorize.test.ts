import { describe, expect, test, vi } from "vitest"

const generateTextMock = vi.fn()

vi.mock("ai", () => ({
  generateText: generateTextMock,
  jsonSchema: (schema: unknown) => schema,
  stepCountIs: (count: number) => ({ count }),
}))

const { executeMemoryMemorize } = await import("../src/tools")

const updatedAt = new Date("2026-05-14T12:00:00.000Z")

function createDb() {
  return {
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.includes("ORDER BY physical_path ASC")) return { rows: [] }
      if (sql.includes("WHERE physical_path = $1")) return { rows: [] }
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
})
