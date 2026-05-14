import { describe, expect, test, vi } from "vitest"
import { MemexAI, MemexAIError } from "../src"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

function createClient(fetchMock: ReturnType<typeof vi.fn>) {
  return new MemexAI({
    url: "http://memex.local",
    apiKey: "agent-key",
    fetch: fetchMock as never,
  })
}

describe("MemexAI SDK — construction", () => {
  test("requires url and api key", () => {
    expect(() => new MemexAI({ url: "", apiKey: "key" })).toThrow(MemexAIError)
    expect(() => new MemexAI({ url: "http://localhost", apiKey: "" })).toThrow(MemexAIError)
  })

  test("requires a user id before creating scoped memory", () => {
    const memex = new MemexAI({ url: "http://localhost", apiKey: "key", fetch: vi.fn() as never })
    expect(() => memex.forUser({ userId: "" })).toThrow(/userId/)
  })
})

describe("MemexAI SDK — prompt-block", () => {
  test("sends bearer auth and calls prompt-block through REST", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ promptBlock: "<memexai_memory />" }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123", actor: "assistant" })

    await expect(memory.getPromptBlock()).resolves.toBe("<memexai_memory />")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://memex.local/v1/prompt-block?userId=user_123&actor=assistant",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer agent-key" }),
      }),
    )
  })
})

describe("MemexAI SDK — file operations", () => {
  test("executes writeFile through the service with tool call id", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: "user/profile.md", created: true, updated: false }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123", actor: "assistant" })

    await memory.writeFile({
      path: "user/profile.md",
      content: "# Profile",
      reason: "test",
      toolCallId: "call_123",
    })

    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe("http://memex.local/v1/tools/memory_write/execute")
    expect(request.headers).toMatchObject({
      authorization: "Bearer agent-key",
      "content-type": "application/json",
    })
    expect(JSON.parse(request.body as string)).toEqual({
      context: { userId: "user_123", actor: "assistant", toolCallId: "call_123" },
      arguments: { path: "user/profile.md", content: "# Profile", reason: "test" },
    })
  })

  test("executes readFile and returns file content", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      path: "user/profile.md",
      content: "# Profile",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123" })

    const result = await memory.readFile({ path: "user/profile.md" })
    expect(result.path).toBe("user/profile.md")
    expect(result.content).toBe("# Profile")

    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe("http://memex.local/v1/tools/memory_read/execute")
    expect(JSON.parse(request.body as string)).toMatchObject({
      context: { userId: "user_123" },
      arguments: { path: "user/profile.md" },
    })
  })

  test("executes listFiles and returns file list", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      files: [{ path: "user/profile.md", size: 100, updatedAt: "2026-01-01T00:00:00.000Z" }],
    }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123" })

    const result = await memory.listFiles({ prefix: "user/" })
    expect(result.files).toHaveLength(1)
    expect(result.files[0]?.path).toBe("user/profile.md")

    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe("http://memex.local/v1/tools/memory_list/execute")
    expect(JSON.parse(request.body as string).arguments).toEqual({ prefix: "user/" })
  })

  test("executes patchFile (append_lines) through the service", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      path: "user/profile.md",
      operation: "append_lines",
      changed: true,
      noOp: false,
    }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123", actor: "assistant" })

    const result = await memory.patchFile({
      path: "user/profile.md",
      operation: "append_lines",
      after_heading: "## Preferences",
      lines: ["- Quiet neighborhood"],
      reason: "captured",
      toolCallId: "call_patch",
    })

    expect(result.changed).toBe(true)
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe("http://memex.local/v1/tools/memory_patch/execute")
    expect(JSON.parse(request.body as string)).toMatchObject({
      context: { userId: "user_123", actor: "assistant", toolCallId: "call_patch" },
      arguments: {
        path: "user/profile.md",
        operation: "append_lines",
        after_heading: "## Preferences",
        lines: ["- Quiet neighborhood"],
      },
    })
  })

  test("executes patchFile (replace_lines) through the service", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      path: "user/profile.md",
      operation: "replace_lines",
      changed: true,
      noOp: false,
    }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123" })

    await memory.patchFile({
      path: "user/profile.md",
      operation: "replace_lines",
      match: "Budget: 2 Cr",
      replacement: "Budget: 2.5 Cr",
    })

    const [, request] = fetchMock.mock.calls[0]
    expect(JSON.parse(request.body as string).arguments).toMatchObject({
      operation: "replace_lines",
      match: "Budget: 2 Cr",
      replacement: "Budget: 2.5 Cr",
    })
  })

  test("executes search through the service", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      query: "neighborhood",
      results: [{ path: "user/profile.md", snippet: "quiet neighborhood", rank: 0.4, updatedAt: "2026-01-01T00:00:00.000Z" }],
      truncated: false,
    }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123", actor: "assistant" })

    const result = await memory.search({ query: "neighborhood", limit: 3, toolCallId: "call_search" })

    expect(result.results[0]?.path).toBe("user/profile.md")
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe("http://memex.local/v1/tools/memory_search/execute")
    expect(JSON.parse(request.body as string)).toEqual({
      context: { userId: "user_123", actor: "assistant", toolCallId: "call_search" },
      arguments: { query: "neighborhood", limit: 3 },
    })
  })

  test("executes memorize through the service", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      text: "Remembered.",
      dryRun: false,
      writes: [{ tool: "memory_write", path: "user/profile.md", reason: "captured" }],
    }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123", actor: "assistant" })

    const result = await memory.memorize({ text: "remember quiet neighborhoods", toolCallId: "call_mem" })

    expect(result.writes[0]?.path).toBe("user/profile.md")
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toBe("http://memex.local/v1/tools/memory_memorize/execute")
    expect(JSON.parse(request.body as string)).toEqual({
      context: { userId: "user_123", actor: "assistant", toolCallId: "call_mem" },
      arguments: { text: "remember quiet neighborhoods" },
    })
  })
})

describe("MemexAI SDK — error handling", () => {
  test("preserves machine-readable service errors", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      error: { code: "READ_ONLY_MOUNT", message: "Agents cannot write to shared/**" },
    }, { status: 403 }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123" })

    await expect(memory.writeFile({ path: "shared/claude.md", content: "nope" }))
      .rejects
      .toMatchObject({ code: "READ_ONLY_MOUNT", status: 403 })
  })

  test("throws on 404 FILE_NOT_FOUND", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      error: { code: "FILE_NOT_FOUND", message: "File not found: user/missing.md" },
    }, { status: 404 }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123" })

    await expect(memory.readFile({ path: "user/missing.md" }))
      .rejects
      .toMatchObject({ code: "FILE_NOT_FOUND", status: 404 })
  })

  test("throws INVALID_JSON_RESPONSE when service returns non-JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("not json", { status: 200 }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123" })

    await expect(memory.listFiles())
      .rejects
      .toMatchObject({ code: "INVALID_JSON_RESPONSE" })
  })

  test("propagates unexpected HTTP errors with a fallback code", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 503 }))
    const memory = createClient(fetchMock).forUser({ userId: "user_123" })

    await expect(memory.listFiles())
      .rejects
      .toMatchObject({ code: "HTTP_503" })
  })
})
