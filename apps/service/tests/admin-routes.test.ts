import { describe, expect, test } from "vitest"
import { buildServer } from "../src/server"

const config = {
  NODE_ENV: "test",
  PORT: 8080,
  DATABASE_URL: "postgresql://localhost/memexai",
  MEMEX_API_KEY: "agent-key",
  MEMEX_ADMIN_SECRET: "admin-secret",
}

const adminHeaders = { "x-memex-admin-secret": "admin-secret" }

function createAdminDb() {
  return {
    query: async (sql: string, values?: unknown[]) => {
      if (sql.includes("WITH user_files AS")) {
        expect(sql).not.toContain("split_part(mx_file.physical_path")
        if (values?.[0] === "%user_4%" && values?.[1] === 50) {
          return {
            rows: [{
              user_id: "user_456",
              file_count: "1",
              last_write_at: new Date("2026-05-10T08:00:00Z"),
              last_read_at: null,
            }],
          }
        }
        return { rows: [{ user_id: "user_123", file_count: "2", last_write_at: new Date("2026-05-09T08:00:00Z"), last_read_at: null }] }
      }

      if (sql.includes("FROM mx_file") && sql.includes("WHERE physical_path = $1") && !sql.includes("LIKE $2")) {
        return {
          rows: [{
            id: "file_1",
            physical_path: values?.[0],
            content_text: "# Profile",
            created_at: new Date("2026-05-09T08:00:00Z"),
            updated_at: new Date("2026-05-09T08:01:00Z"),
          }],
        }
      }

      if (sql.includes("FROM mx_file") && !sql.includes("FROM mx_file f")) {
        return {
          rows: [{
            id: "file_1",
            physical_path: "users/user_123/profile.md",
            content_text: "# Profile",
            created_at: new Date("2026-05-09T08:00:00Z"),
            updated_at: new Date("2026-05-09T08:01:00Z"),
          }],
        }
      }

      if (sql.includes("COUNT(*) AS total") && sql.includes("FROM mx_revision")) {
        return { rows: [{ total: "1" }] }
      }

      if (sql.includes("FROM mx_revision") && !sql.includes("HAVING COUNT(*) > 1")) {
        return {
          rows: [{
            id: "rev_1",
            file_id: "file_1",
            physical_path: "users/user_123/profile.md",
            operation: "write",
            content_text: "# Profile",
            reason: "test",
            actor: "assistant",
            user_id: "user_123",
            tool_call_id: "call_1",
            created_at: new Date("2026-05-09T08:02:00Z"),
          }],
        }
      }

      if (sql.includes("access_buckets")) {
        return {
          rows: [{
            bucket_start: new Date("2026-05-09T08:00:00Z"),
            reads: "4",
            writes: "1",
            searches: "2",
            smart_reads: "1",
            tool_calls: "5",
            errors: "1",
            p50_ms: "100",
            p95_ms: "300",
          }],
        }
      }

      if (sql.includes("FROM mx_observation_event") && sql.includes("percentile_cont") && !sql.includes("failed_calls")) {
        return {
          rows: [{
            tool_calls: "12",
            prompt_blocks: "3",
            errors: "1",
            active_users: "2",
            p50_ms: "120",
            p95_ms: "420",
            slowest_tool_name: "memory_search",
          }],
        }
      }

      if (sql.includes("COUNT(*) AS file_hits")) {
        return {
          rows: [{
            file_hits: "6",
            reads: "1",
            writes: "2",
            searches: "1",
            smart_reads: "2",
          }],
        }
      }

      if (sql.includes("COUNT(DISTINCT physical_path) FILTER")) {
        return {
          rows: [{
            files_read: "2",
            files_written: "1",
            searches: "3",
          }],
        }
      }

      if (sql.includes("FROM mx_access_log") && sql.includes("GROUP BY physical_path") && sql.includes("operation = 'read'")) {
        return {
          rows: [{
            physical_path: "users/user_123/profile.md",
            count: "4",
            last_seen_at: new Date("2026-05-09T08:03:00Z"),
          }],
        }
      }

      if (sql.includes("FROM mx_access_log") && sql.includes("GROUP BY physical_path") && sql.includes("operation IN ('write', 'patch')")) {
        return {
          rows: [{
            physical_path: "users/user_123/profile.md",
            count: "2",
            last_seen_at: new Date("2026-05-09T08:04:00Z"),
          }],
        }
      }

      if (sql.includes("FROM mx_revision") && sql.includes("HAVING COUNT(*) > 1")) {
        return {
          rows: [{
            physical_path: "users/user_123/profile.md",
            count: "3",
            last_seen_at: new Date("2026-05-09T08:05:00Z"),
          }],
        }
      }

      if (sql.includes("FROM mx_file f") && sql.includes("HAVING COUNT(l.id) = 0")) {
        return {
          rows: [{
            physical_path: "users/user_123/unused.md",
            created_at: new Date("2026-05-09T08:06:00Z"),
            read_count: "0",
          }],
        }
      }

      if (sql.includes("COUNT(*) FILTER (WHERE status = 'error') AS failed_calls")) {
        return {
          rows: [{
            failed_calls: "1",
            p95_ms: "420",
          }],
        }
      }

      if (sql.includes("FROM mx_access_log l")) {
        return {
          rows: [{
            physical_path: "users/user_123/profile.md",
            reads: "4",
            writes: "1",
            searches: "0",
            smart_reads: "0",
            total_hits: "5",
            unique_users: "1",
            size: "9",
            last_accessed_at: new Date("2026-05-09T08:03:00Z"),
          }],
        }
      }

      if (sql.includes("FROM mx_observation_event")) {
        return {
          rows: [{
            id: "obs_1",
            event_type: "tool_execution",
            status: "success",
            duration_ms: 120,
            user_id: "user_123",
            actor: "assistant",
            tool_name: "memory_search",
            operation: "search",
            physical_path: null,
            tool_call_id: "call_1",
            error_code: null,
            attributes: { files_returned: 1 },
            created_at: new Date("2026-05-09T08:03:00Z"),
          }],
        }
      }

      if (sql.includes("FROM mx_access_log")) {
        return {
          rows: [{
            id: "log_1",
            file_id: "file_1",
            physical_path: "users/user_123/profile.md",
            operation: "read",
            actor: "assistant",
            user_id: "user_123",
            tool_call_id: "call_1",
            created_at: new Date("2026-05-09T08:03:00Z"),
          }],
        }
      }

      return { rows: [] }
    },
  }
}

describe("admin routes", () => {
  test("lists derived users", async () => {
    const app = buildServer({ db: createAdminDb() as never, config })
    const response = await app.inject({ method: "GET", url: "/v1/admin/users", headers: adminHeaders })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().users[0]).toMatchObject({ userId: "user_123", fileCount: 2 })
  })

  test("searches and limits derived users", async () => {
    const app = buildServer({ db: createAdminDb() as never, config })
    const response = await app.inject({ method: "GET", url: "/v1/admin/users?q=user_4&limit=50", headers: adminHeaders })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().users[0]).toMatchObject({ userId: "user_456", fileCount: 1 })
  })

  test("returns file details by physical path", async () => {
    const app = buildServer({ db: createAdminDb() as never, config })
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/files/users%2Fuser_123%2Fprofile.md",
      headers: adminHeaders,
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().file).toMatchObject({
      physicalPath: "users/user_123/profile.md",
      content: "# Profile",
    })
  })

  test("lists revisions and access logs", async () => {
    const app = buildServer({ db: createAdminDb() as never, config })
    const revisions = await app.inject({ method: "GET", url: "/v1/admin/revisions?actor=dream-agent&userId=user_123&from=2026-05-09T00%3A00%3A00.000Z&limit=500&offset=10", headers: adminHeaders })
    const logs = await app.inject({ method: "GET", url: "/v1/admin/access-logs", headers: adminHeaders })
    await app.close()

    expect(revisions.statusCode).toBe(200)
    expect(revisions.json().revisions[0].toolCallId).toBe("call_1")
    expect(revisions.json().pagination).toMatchObject({ limit: 200, offset: 10, total: 1, hasMore: false })
    expect(logs.statusCode).toBe(200)
    expect(logs.json().accessLogs[0].operation).toBe("read")
  })

  test("returns observability overview data", async () => {
    const app = buildServer({ db: createAdminDb() as never, config })
    const summary = await app.inject({ method: "GET", url: "/v1/admin/observability/summary?userId=user_123", headers: adminHeaders })
    const timeseries = await app.inject({ method: "GET", url: "/v1/admin/observability/timeseries?bucket=hour", headers: adminHeaders })
    const topFiles = await app.inject({ method: "GET", url: "/v1/admin/observability/top-files?limit=10", headers: adminHeaders })
    const events = await app.inject({ method: "GET", url: "/v1/admin/observability/events?limit=10", headers: adminHeaders })
    await app.close()

    expect(summary.statusCode).toBe(200)
    expect(summary.json().totals).toMatchObject({ toolCalls: 12, reads: 1 })
    expect(timeseries.statusCode).toBe(200)
    expect(timeseries.json().buckets[0]).toMatchObject({ reads: 4, p95Ms: 300 })
    expect(topFiles.statusCode).toBe(200)
    expect(topFiles.json().files[0]).toMatchObject({ physicalPath: "users/user_123/profile.md", totalHits: 5 })
    expect(events.statusCode).toBe(200)
    expect(events.json().events[0]).toMatchObject({ eventType: "tool_execution", toolName: "memory_search" })
  })

  test("returns user memory observability data", async () => {
    const app = buildServer({ db: createAdminDb() as never, config })
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/observability/user?userId=user_123",
      headers: adminHeaders,
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().summary).toMatchObject({ filesRead: 2, filesWritten: 1, failedCalls: 1, p95Ms: 420 })
    expect(response.json().topReadFiles[0]).toMatchObject({ physicalPath: "users/user_123/profile.md", count: 4 })
    expect(response.json().rewrittenFiles[0]).toMatchObject({ count: 3 })
    expect(response.json().rarelyReadFiles[0]).toMatchObject({ physicalPath: "users/user_123/unused.md" })
  })

  test("does not expose admin mutation routes", async () => {
    const app = buildServer({ db: createAdminDb() as never, config })
    const response = await app.inject({ method: "POST", url: "/v1/admin/files", headers: adminHeaders })
    await app.close()

    expect(response.statusCode).toBe(404)
  })
})
