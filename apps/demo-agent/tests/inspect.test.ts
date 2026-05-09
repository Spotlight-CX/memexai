import { describe, expect, test, vi } from "vitest"
import { inspectMemory, parseInspectArgs } from "../src/inspect"

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

function createFetchMock() {
  return vi.fn(async (url: string | URL | Request) => {
    const href = String(url)
    if (href.endsWith("/v1/tools/memory_list/execute")) {
      return jsonResponse({
        files: [
          { path: "shared/index.md", size: 20, updatedAt: "2026-05-09T00:00:00.000Z" },
          { path: "user/preferences.md", size: 42, updatedAt: "2026-05-09T00:00:00.000Z" },
        ],
      })
    }

    if (href.endsWith("/v1/tools/memory_read/execute")) {
      return jsonResponse({
        path: "user/preferences.md",
        content: "I prefer quiet projects near good schools.",
        updatedAt: "2026-05-09T00:00:00.000Z",
      })
    }

    return jsonResponse({})
  })
}

describe("inspect CLI", () => {
  test("parses user and path args", () => {
    expect(parseInspectArgs(["--user", "demo_user", "--path", "user/preferences.md"])).toEqual({
      userId: "demo_user",
      path: "user/preferences.md",
    })
  })

  test("lists and reads memory using SDK", async () => {
    const fetchMock = createFetchMock()
    const log = vi.fn()

    const result = await inspectMemory({
      argv: ["--user", "demo_user", "--path", "user/preferences.md"],
      env: {
        MEMEX_URL: "http://localhost:8080",
        MEMEX_API_KEY: "dev-api-key",
      },
      fetchImpl: fetchMock as never,
      log,
    })

    expect(result.userId).toBe("demo_user")
    expect(result.file?.content).toContain("quiet projects")
    expect(log).toHaveBeenCalledWith("  user/preferences.md (42 bytes, updated 2026-05-09T00:00:00.000Z)")
    expect(log).toHaveBeenCalledWith("--- user/preferences.md ---")
  })

  test("interactive mode keeps prompting until blank input", async () => {
    const fetchMock = createFetchMock()
    const answers = ["demo_user", "user/preferences.md", ""]

    const result = await inspectMemory({
      argv: [],
      env: {
        MEMEX_URL: "http://localhost:8080",
        MEMEX_API_KEY: "dev-api-key",
      },
      fetchImpl: fetchMock as never,
      log: vi.fn(),
      prompt: vi.fn(async () => answers.shift() ?? ""),
    })

    expect(result.file?.path).toBe("user/preferences.md")
  })
})
