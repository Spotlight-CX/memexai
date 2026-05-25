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

      if (sql.includes("FROM mx_file")) {
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

      if (sql.includes("FROM mx_revision")) {
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
    const revisions = await app.inject({ method: "GET", url: "/v1/admin/revisions", headers: adminHeaders })
    const logs = await app.inject({ method: "GET", url: "/v1/admin/access-logs", headers: adminHeaders })
    await app.close()

    expect(revisions.statusCode).toBe(200)
    expect(revisions.json().revisions[0].toolCallId).toBe("call_1")
    expect(logs.statusCode).toBe(200)
    expect(logs.json().accessLogs[0].operation).toBe("read")
  })

  test("does not expose admin mutation routes", async () => {
    const app = buildServer({ db: createAdminDb() as never, config })
    const response = await app.inject({ method: "POST", url: "/v1/admin/files", headers: adminHeaders })
    await app.close()

    expect(response.statusCode).toBe(404)
  })
})
