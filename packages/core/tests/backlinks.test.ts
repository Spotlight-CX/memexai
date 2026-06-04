import { describe, expect, test, vi } from "vitest"
import { extractWikiLinks, getInboundLinks, getInboundLinksForPaths, syncBacklinks } from "../src/backlinks"
import type { ToolContext } from "../src/paths"

const CTX: ToolContext = { userId: "u1" }

// --- extractWikiLinks ---

describe("extractWikiLinks", () => {
  test("parses a single link", () => {
    expect(extractWikiLinks("See [[user/foo.md]] for details")).toEqual(["user/foo.md"])
  })

  test("parses shared/ links", () => {
    expect(extractWikiLinks("[[shared/index.md]]")).toEqual(["shared/index.md"])
  })

  test("parses multiple links", () => {
    const result = extractWikiLinks("[[user/a.md]] and [[user/b.md]]")
    expect(result).toContain("user/a.md")
    expect(result).toContain("user/b.md")
    expect(result).toHaveLength(2)
  })

  test("deduplicates repeated links", () => {
    expect(extractWikiLinks("[[user/foo.md]] again [[user/foo.md]]")).toEqual(["user/foo.md"])
  })

  test("ignores malformed unclosed [[", () => {
    expect(extractWikiLinks("[[unclosed")).toEqual([])
  })

  test("ignores empty [[]]", () => {
    expect(extractWikiLinks("[[]]")).toEqual([])
  })

  test("ignores links containing newlines", () => {
    expect(extractWikiLinks("[[\nfoo.md]]")).toEqual([])
  })

  test("trims whitespace inside brackets", () => {
    expect(extractWikiLinks("[[ user/foo.md ]]")).toEqual(["user/foo.md"])
  })

  test("returns [] for content with no links", () => {
    expect(extractWikiLinks("no links here")).toEqual([])
  })

  test("returns [] for empty string", () => {
    expect(extractWikiLinks("")).toEqual([])
  })
})

// --- syncBacklinks ---

function makeMockDb(backlinkRows: { target_path: string }[] = []) {
  return {
    query: vi.fn(async (sql: string, values: unknown[] = []) => {
      if (sql.includes("SELECT target_path FROM mx_backlink")) {
        return { rows: backlinkRows }
      }
      return { rows: [] }
    }),
    connect: vi.fn(),
    end: vi.fn(),
  } as unknown as import("../src/db").Db
}

describe("syncBacklinks", () => {
  test("inserts backlinks for new content with WikiLinks", async () => {
    const db = makeMockDb()
    await syncBacklinks(db, "users/u1/notes.md", "See [[user/preferences.md]]", CTX)

    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    const insertCall = calls.find(([sql]: [string]) => sql.includes("INSERT INTO mx_backlink"))
    expect(insertCall).toBeDefined()
    expect(insertCall[1]).toContain("users/u1/preferences.md")
  })

  test("inserts shared/ links correctly", async () => {
    const db = makeMockDb()
    await syncBacklinks(db, "users/u1/notes.md", "See [[shared/index.md]]", CTX)

    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    const insertCall = calls.find(([sql]: [string]) => sql.includes("INSERT INTO mx_backlink"))
    expect(insertCall).toBeDefined()
    expect(insertCall[1]).toContain("shared/index.md")
  })

  test("deletes stale rows when a WikiLink is removed", async () => {
    const db = makeMockDb([{ target_path: "users/u1/old.md" }])
    await syncBacklinks(db, "users/u1/notes.md", "no links now", CTX)

    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    const deleteCall = calls.find(([sql]: [string]) => sql.includes("DELETE FROM mx_backlink"))
    expect(deleteCall).toBeDefined()

    // No INSERT since no new links
    const insertCall = calls.find(([sql]: [string]) => sql.includes("INSERT INTO mx_backlink"))
    expect(insertCall).toBeUndefined()

    // importance_score recomputed for old target
    const updateCall = calls.find(([sql]: [string]) => sql.includes("UPDATE mx_file") && sql.includes("importance_score"))
    expect(updateCall).toBeDefined()
    expect((updateCall[1] as string[])[0]).toContain("users/u1/old.md")
  })

  test("excludes self-links (source_path === target_path)", async () => {
    const db = makeMockDb()
    await syncBacklinks(db, "users/u1/notes.md", "[[user/notes.md]]", CTX)

    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    const insertCall = calls.find(([sql]: [string]) => sql.includes("INSERT INTO mx_backlink"))
    expect(insertCall).toBeUndefined()
  })

  test("handles content with no WikiLinks — deletes all existing rows", async () => {
    const db = makeMockDb([{ target_path: "users/u1/other.md" }])
    await syncBacklinks(db, "users/u1/notes.md", "plain text, no links", CTX)

    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    const deleteCall = calls.find(([sql]: [string]) => sql.includes("DELETE FROM mx_backlink"))
    expect(deleteCall).toBeDefined()
    const insertCall = calls.find(([sql]: [string]) => sql.includes("INSERT INTO mx_backlink"))
    expect(insertCall).toBeUndefined()
  })

  test("drops unrecognized link namespaces silently", async () => {
    const db = makeMockDb()
    // "org/foo.md" is not user/ or shared/ — should be ignored
    await syncBacklinks(db, "users/u1/notes.md", "[[org/foo.md]]", CTX)

    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    const insertCall = calls.find(([sql]: [string]) => sql.includes("INSERT INTO mx_backlink"))
    expect(insertCall).toBeUndefined()
  })

  test("updates importance_score for all affected targets", async () => {
    const db = makeMockDb([{ target_path: "users/u1/old.md" }])
    await syncBacklinks(db, "users/u1/notes.md", "[[user/new.md]]", CTX)

    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    const updateCall = calls.find(([sql]: [string]) => sql.includes("UPDATE mx_file") && sql.includes("importance_score"))
    expect(updateCall).toBeDefined()
    const affectedPaths = (updateCall[1] as string[][])[0]
    expect(affectedPaths).toContain("users/u1/old.md")
    expect(affectedPaths).toContain("users/u1/new.md")
  })

  test("skips importance_score update when no targets affected", async () => {
    const db = makeMockDb()
    await syncBacklinks(db, "users/u1/notes.md", "plain text", CTX)

    const calls = (db.query as ReturnType<typeof vi.fn>).mock.calls
    const updateCall = calls.find(([sql]: [string]) => sql.includes("UPDATE mx_file") && sql.includes("importance_score"))
    expect(updateCall).toBeUndefined()
  })
})

// --- getInboundLinks ---

describe("getInboundLinks", () => {
  test("returns source_paths for a given target", async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [{ source_path: "users/u1/visit-jan.md" }, { source_path: "users/u1/chat.md" }],
      })),
      connect: vi.fn(),
      end: vi.fn(),
    } as unknown as import("../src/db").Db

    const result = await getInboundLinks(db, "users/u1/preferences.md")
    expect(result).toEqual(["users/u1/visit-jan.md", "users/u1/chat.md"])
  })

  test("returns [] when no inbound links exist (orphan file)", async () => {
    const db = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(),
      end: vi.fn(),
    } as unknown as import("../src/db").Db

    const result = await getInboundLinks(db, "users/u1/orphan.md")
    expect(result).toEqual([])
  })
})

// --- getInboundLinksForPaths ---

describe("getInboundLinksForPaths", () => {
  test("returns source+target pairs for multiple targets", async () => {
    const db = {
      query: vi.fn(async () => ({
        rows: [
          { source_path: "users/u1/a.md", target_path: "users/u1/hub.md" },
          { source_path: "users/u1/b.md", target_path: "users/u1/hub.md" },
        ],
      })),
      connect: vi.fn(),
      end: vi.fn(),
    } as unknown as import("../src/db").Db

    const result = await getInboundLinksForPaths(db, ["users/u1/hub.md"])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ sourcePath: "users/u1/a.md", targetPath: "users/u1/hub.md" })
  })

  test("returns [] for empty input without querying the DB", async () => {
    const db = {
      query: vi.fn(async () => ({ rows: [] })),
      connect: vi.fn(),
      end: vi.fn(),
    } as unknown as import("../src/db").Db

    const result = await getInboundLinksForPaths(db, [])
    expect(result).toEqual([])
    expect(db.query).not.toHaveBeenCalled()
  })
})

// --- circular link pair ---

describe("circular links (A → B, B → A)", () => {
  test("both directions are stored; getInboundLinks returns the correct source", async () => {
    const storedLinks: Array<{ source_path: string; target_path: string }> = []

    const db = {
      query: vi.fn(async (sql: string, values: unknown[]) => {
        if (sql.includes("SELECT target_path FROM mx_backlink WHERE source_path")) {
          const src = values[0] as string
          return { rows: storedLinks.filter((l) => l.source_path === src).map((l) => ({ target_path: l.target_path })) }
        }
        if (sql.includes("DELETE FROM mx_backlink WHERE source_path")) {
          const src = values[0] as string
          const idx = storedLinks.findIndex((l) => l.source_path === src)
          if (idx !== -1) storedLinks.splice(idx, 1)
          return { rows: [] }
        }
        if (sql.includes("INSERT INTO mx_backlink")) {
          const src = values[0] as string
          const targets = values.slice(1) as string[]
          for (const tgt of targets) storedLinks.push({ source_path: src, target_path: tgt })
          return { rows: [] }
        }
        if (sql.includes("SELECT source_path FROM mx_backlink WHERE target_path")) {
          const tgt = values[0] as string
          return { rows: storedLinks.filter((l) => l.target_path === tgt).map((l) => ({ source_path: l.source_path })) }
        }
        return { rows: [] }
      }),
      connect: vi.fn(),
      end: vi.fn(),
    } as unknown as import("../src/db").Db

    await syncBacklinks(db, "users/u1/a.md", "[[user/b.md]]", CTX)
    await syncBacklinks(db, "users/u1/b.md", "[[user/a.md]]", CTX)

    const inboundA = await getInboundLinks(db, "users/u1/a.md")
    const inboundB = await getInboundLinks(db, "users/u1/b.md")

    expect(inboundA).toContain("users/u1/b.md")
    expect(inboundB).toContain("users/u1/a.md")
  })
})
