import { describe, expect, test, vi } from "vitest"

const executeMemoryConsolidateMock = vi.fn()

vi.mock("../src/tools", () => ({
  executeMemoryConsolidate: executeMemoryConsolidateMock,
}))

const { readDreamConfig, resetStaleDreamRuns, runDreamCycle, selectUsersToDream } = await import("../src/dream-scheduler")

function createDb(rowsBySql: (sql: string, values?: unknown[]) => unknown[] = () => []) {
  return {
    query: vi.fn(async (sql: string, values?: unknown[]) => ({ rows: rowsBySql(sql, values) })),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("dream scheduler", () => {
  test("reads dream config with defaults", async () => {
    const db = createDb((sql) => sql.includes("FROM mx_config")
      ? [
        { key: "dream_enabled", value: "true" },
        { key: "dream_interval_minutes", value: "15" },
        { key: "dream_grace_period_minutes", value: "5" },
      ]
      : [])

    await expect(readDreamConfig(db)).resolves.toMatchObject({
      enabled: true,
      intervalMinutes: 15,
      gracePeriodMinutes: 5,
      maxWrites: 10,
      concurrency: 3,
    })
  })

  test("selects users through mx_file and mx_dream_run filters", async () => {
    const db = createDb((sql, values) => {
      if (sql.includes("WITH user_writes AS")) {
        expect(sql).toContain("regexp_match(physical_path, '^users/([^/]+)/')")
        expect(sql).toContain("coalesce(mx_dream_run.paused, false) = false")
        expect(values).toEqual([30])
        return [{ user_id: "u1" }]
      }
      return []
    })

    await expect(selectUsersToDream(db)).resolves.toEqual(["u1"])
  })

  test("resets stale running dreams", async () => {
    const db = createDb()

    await resetStaleDreamRuns(db)

    expect((db.query as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain("last_started_at < now() - interval '10 minutes'")
  })

  test("marks completed dreams", async () => {
    executeMemoryConsolidateMock.mockResolvedValueOnce({ filesTouched: ["user/profile.md", "user/dream-log.md"] })
    const db = createDb((sql) => {
      if (sql.includes("WITH user_writes AS")) return [{ user_id: "u1" }]
      return []
    })

    const result = await runDreamCycle(db, {
      enabled: true,
      intervalMinutes: 60,
      gracePeriodMinutes: 30,
      maxWrites: 10,
      concurrency: 1,
    }, { model: { id: "mock" } })

    expect(result).toMatchObject({ status: "updated", usersProcessed: 1, filesTouched: 1 })
    expect(executeMemoryConsolidateMock).toHaveBeenCalledWith(db, { userId: "u1", actor: "dream-agent" }, { model: { id: "mock" }, maxWrites: 10 })
    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.some(([sql]) => String(sql).includes("VALUES ($1, $2, 'running'"))).toBe(true)
    expect(calls.some(([sql, values]) => String(sql).includes("status = 'completed'") && (values as unknown[])[1] === 1)).toBe(true)
  })

  test("marks failed dreams with error text", async () => {
    executeMemoryConsolidateMock.mockRejectedValueOnce(new Error("model failed"))
    const db = createDb((sql) => sql.includes("WITH user_writes AS") ? [{ user_id: "u1" }] : [])

    const result = await runDreamCycle(db, {
      enabled: true,
      intervalMinutes: 60,
      gracePeriodMinutes: 30,
      maxWrites: 10,
      concurrency: 1,
    }, { model: { id: "mock" } })

    expect(result).toMatchObject({ status: "noop", usersProcessed: 1, filesTouched: 0 })
    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    expect(calls.some(([sql, values]) => String(sql).includes("status = 'failed'") && (values as unknown[])[1] === "model failed")).toBe(true)
  })
})
