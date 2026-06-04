import { describe, expect, test, vi } from "vitest"
import { loadConfig } from "../src/config"
import { createSearchRuntime } from "../src/search-config"
import { buildServer } from "../src/server"

function config(env: Record<string, string> = {}) {
  return loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://localhost/memexai",
    MEMEX_API_KEY: "agent-key",
    MEMEX_ADMIN_SECRET: "admin-secret",
    ...env,
  })
}

const adminHeaders = { "x-memex-admin-secret": "admin-secret" }

describe("search config", () => {
  test("MEMEX_SEARCH_MODE=bm25 disables embedding adapter even with a key", () => {
    const runtime = createSearchRuntime(config({ MEMEX_SEARCH_MODE: "bm25", GEMINI_API_KEY: "gemini-key" }))

    expect(runtime.mode).toBe("bm25")
    expect(runtime.embedding?.adapter).toBeUndefined()
    expect(runtime.vectorEnabled).toBe(false)
  })

  test("auto with GEMINI_API_KEY enables hybrid Gemini embeddings", () => {
    const runtime = createSearchRuntime(config({ MEMEX_SEARCH_MODE: "auto", GEMINI_API_KEY: "gemini-key" }))

    expect(runtime).toMatchObject({
      mode: "hybrid",
      provider: "gemini",
      model: "gemini-embedding-001",
      dimensions: 768,
      vectorEnabled: true,
    })
    expect(runtime.embedding?.adapter?.model).toBe("gemini-embedding-001")
  })

  test("auto with GOOGLE_GENERATIVE_AI_API_KEY enables hybrid Gemini embeddings", () => {
    const runtime = createSearchRuntime(config({ MEMEX_SEARCH_MODE: "auto", GOOGLE_GENERATIVE_AI_API_KEY: "gemini-key" }))

    expect(runtime).toMatchObject({
      mode: "hybrid",
      provider: "gemini",
      model: "gemini-embedding-001",
      dimensions: 768,
      vectorEnabled: true,
    })
    expect(runtime.embedding?.adapter?.model).toBe("gemini-embedding-001")
  })

  test("auto without a Gemini key stays BM25", () => {
    const runtime = createSearchRuntime(config({ MEMEX_SEARCH_MODE: "auto" }))

    expect(runtime.mode).toBe("bm25")
    expect(runtime.embedding).toBeUndefined()
  })

  test("admin search status returns resolved metadata", async () => {
    const runtime = createSearchRuntime(config({ GEMINI_API_KEY: "gemini-key" }))
    const app = buildServer({ db: { query: vi.fn() } as never, config: config(), search: runtime })

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/search/status",
      headers: adminHeaders,
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      mode: "hybrid",
      provider: "gemini",
      model: "gemini-embedding-001",
      dimensions: 768,
    })
  })

  test("BM25 file response omits embedding fields and avoids embedding columns", async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        expect(sql).not.toContain("f.embedding_model")
        if (sql.includes("FROM mx_file f")) {
          return {
            rows: [{
              id: "file_1",
              physical_path: "users/u1/profile.md",
              content_text: "# Profile",
              created_at: new Date("2026-06-03T09:00:00Z"),
              updated_at: new Date("2026-06-03T09:01:00Z"),
              latest_op: null,
              latest_actor: null,
              latest_reason: null,
              latest_rev_at: null,
              revision_count: "0",
            }],
          }
        }
        return { rows: [] }
      }),
    }
    const app = buildServer({ db: db as never, config: config(), search: createSearchRuntime(config({ MEMEX_SEARCH_MODE: "bm25" })) })

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/files/users%2Fu1%2Fprofile.md",
      headers: adminHeaders,
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().file.embeddingStatus).toBeUndefined()
  })

  test("hybrid file response includes embedding fields", async () => {
    const runtime = createSearchRuntime(config({ GEMINI_API_KEY: "gemini-key" }))
    const hash = "ac523f1d7797bca076362be295202bc57fb4cd2012fe72ef56b4b6f971f25e10"
    const db = {
      query: vi.fn(async (sql: string) => {
        expect(sql).toContain("f.embedding_model")
        if (sql.includes("FROM mx_file f")) {
          return {
            rows: [{
              id: "file_1",
              physical_path: "users/u1/profile.md",
              content_text: "# Profile",
              created_at: new Date("2026-06-03T09:00:00Z"),
              updated_at: new Date("2026-06-03T09:01:00Z"),
              embedding_model: "gemini-embedding-001",
              embedding_dimensions: 768,
              embedding_strategy: "full",
              embedding_chunk_count: 1,
              embedding_content_hash: hash,
              embedding_updated_at: new Date("2026-06-03T09:02:00Z"),
              latest_op: null,
              latest_actor: null,
              latest_reason: null,
              latest_rev_at: null,
              revision_count: "0",
            }],
          }
        }
        return { rows: [] }
      }),
    }
    const app = buildServer({ db: db as never, config: config(), search: runtime })

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/files/users%2Fu1%2Fprofile.md",
      headers: adminHeaders,
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().file).toMatchObject({
      embeddingStatus: "fresh",
      embeddingModel: "gemini-embedding-001",
      embeddingDimensions: 768,
      embeddingStrategy: "full",
      embeddingChunkCount: 1,
    })
  })

  test("BM25 mode makes no provider calls on tool writes", async () => {
    const embed = vi.fn(async () => [1, 2, 3])
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO mx_file")) return { rows: [{ id: "file_1", created: true }] }
        return { rows: [] }
      }),
    }
    const app = buildServer({
      db: db as never,
      config: config(),
      search: {
        mode: "bm25",
        provider: null,
        model: null,
        dimensions: null,
        vectorEnabled: false,
        rrfK: 60,
        bm25CandidateLimit: 50,
        vectorCandidateLimit: 50,
        embedding: { adapter: { model: "mock", dimensions: 3, embed } },
      },
    })

    const response = await app.inject({
      method: "POST",
      url: "/v1/tools/memory_write/execute",
      headers: { authorization: "Bearer agent-key" },
      payload: {
        context: { userId: "u1" },
        arguments: { path: "user/profile.md", content: "# Profile" },
      },
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(embed).not.toHaveBeenCalled()
  })
})
