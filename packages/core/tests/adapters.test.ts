import { describe, expect, test, vi } from "vitest"
import { Memex } from "../src/memex"

function createMockDb() {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("mx_access_log")) return { rows: [] }
      return { rows: [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("MemexUser toolsets", () => {
  test("createAgenticToolset exposes memorize and search only", () => {
    const user = new Memex(createMockDb()).forUser({ userId: "u1" })
    expect(Object.keys(user.createAgenticToolset())).toEqual(["memory_memorize", "memory_search"])
  })

  test("createRawToolset exposes raw file tools only", () => {
    const user = new Memex(createMockDb()).forUser({ userId: "u1" })
    expect(Object.keys(user.createRawToolset())).toEqual([
      "memory_list",
      "memory_read",
      "memory_write",
      "memory_patch",
      "memory_smart_read",
    ])
  })

  test("raw toolset execution preserves toolCallId", async () => {
    const db = createMockDb()
    const user = new Memex(db).forUser({ userId: "u1", actor: "agent" })
    const tools = user.createRawToolset()

    await tools.memory_list.execute({}, { toolCallId: "call_raw" })

    const logCall = (db.query as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("mx_access_log"),
    )
    expect(logCall?.[1]).toContain("call_raw")
  })
})
