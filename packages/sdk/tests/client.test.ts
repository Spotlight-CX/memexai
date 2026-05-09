import { describe, expect, test, vi } from "vitest"
import { MemexAI, MemexAIError } from "../src"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  })
}

describe("MemexAI SDK", () => {
  test("requires url and api key", () => {
    expect(() => new MemexAI({ url: "", apiKey: "key" })).toThrow(MemexAIError)
    expect(() => new MemexAI({ url: "http://localhost", apiKey: "" })).toThrow(MemexAIError)
  })

  test("requires a user id before creating scoped memory", () => {
    const memex = new MemexAI({ url: "http://localhost", apiKey: "key", fetch: vi.fn() as never })
    expect(() => memex.forUser({ userId: "" })).toThrow(/userId/)
  })

  test("sends bearer auth and calls prompt-block through REST", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ promptBlock: "<memexai_memory />" }))
    const memory = new MemexAI({
      url: "http://memex.local/",
      apiKey: "agent-key",
      fetch: fetchMock as never,
    }).forUser({ userId: "user_123", actor: "assistant" })

    await expect(memory.getPromptBlock()).resolves.toBe("<memexai_memory />")

    expect(fetchMock).toHaveBeenCalledWith(
      "http://memex.local/v1/prompt-block?userId=user_123&actor=assistant",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer agent-key" }),
      }),
    )
  })

  test("executes writeFile through the service with tool call id", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ path: "user/profile.md", created: true, updated: false }))
    const memory = new MemexAI({
      url: "http://memex.local",
      apiKey: "agent-key",
      fetch: fetchMock as never,
    }).forUser({ userId: "user_123", actor: "assistant" })

    await memory.writeFile({
      path: "user/profile.md",
      content: "# Profile",
      reason: "test",
      toolCallId: "call_123",
    })

    const [, request] = fetchMock.mock.calls[0]
    expect(fetchMock.mock.calls[0][0]).toBe("http://memex.local/v1/tools/memory_write/execute")
    expect(request.headers).toMatchObject({
      authorization: "Bearer agent-key",
      "content-type": "application/json",
    })
    expect(JSON.parse(request.body as string)).toEqual({
      context: { userId: "user_123", actor: "assistant", toolCallId: "call_123" },
      arguments: { path: "user/profile.md", content: "# Profile", reason: "test" },
    })
  })

  test("preserves machine-readable service errors", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      error: { code: "READ_ONLY_MOUNT", message: "Agents cannot write to shared/**" },
    }, { status: 403 }))
    const memory = new MemexAI({
      url: "http://memex.local",
      apiKey: "agent-key",
      fetch: fetchMock as never,
    }).forUser({ userId: "user_123" })

    await expect(memory.writeFile({ path: "shared/claude.md", content: "nope" }))
      .rejects
      .toMatchObject({ code: "READ_ONLY_MOUNT", status: 403 })
  })
})
