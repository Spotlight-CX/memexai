import { describe, expect, test, vi } from "vitest"
import { loadConfig } from "../src/config"
import {
  countBucket,
  createTelemetryClient,
  durationBucket,
  sanitizeTelemetryProperties,
} from "../src/telemetry"

describe("telemetry", () => {
  test("sanitizes event properties with an allowlist", () => {
    expect(sanitizeTelemetryProperties({
      tool_name: "memory_write",
      success: true,
      duration_bucket: "lt_100ms",
      userId: "user_123",
      actor: "assistant",
      path: "user/profile.md",
      content: "secret memory",
      arguments: "{}",
      DATABASE_URL: "postgresql://secret",
    })).toEqual({
      tool_name: "memory_write",
      success: true,
      duration_bucket: "lt_100ms",
    })
  })

  test("buckets durations and counts", () => {
    expect(durationBucket(99)).toBe("lt_100ms")
    expect(durationBucket(700)).toBe("500_999ms")
    expect(durationBucket(5000)).toBe("gt_5s")
    expect(countBucket(0)).toBe("0")
    expect(countBucket(3)).toBe("2_5")
    expect(countBucket(21)).toBe("gt_20")
  })

  test("creates a no-op client when telemetry is disabled", async () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://localhost/memexai",
      MEMEX_API_KEY: "dev-key",
      MEMEX_TELEMETRY_DISABLED: "true",
      MEMEX_TELEMETRY_POSTHOG_KEY: "phc_test",
    })
    const fetchMock = vi.fn()
    const client = await createTelemetryClient({ config, fetch: fetchMock })

    client.capture("service_started")
    await client.flush()

    expect(client.enabled).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("captures sanitized events when enabled", async () => {
    const config = loadConfig({
      DATABASE_URL: "postgresql://localhost/memexai",
      MEMEX_API_KEY: "dev-key",
      MEMEX_TELEMETRY_POSTHOG_KEY: "phc_test",
      MEMEX_TELEMETRY_POSTHOG_HOST: "https://example.test",
    })
    const fetchMock = vi.fn(async () => ({ ok: true }))
    const client = await createTelemetryClient({ config, fetch: fetchMock, serviceVersion: "0.1.0" })

    client.capture("tool_executed", {
      tool_name: "memory_write",
      success: true,
      path: "user/private.md",
    })
    await client.flush()

    expect(client.enabled).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(init.body as string)).toMatchObject({
      api_key: "phc_test",
      event: "tool_executed",
      properties: {
        service_version: "0.1.0",
        tool_name: "memory_write",
        success: true,
      },
    })
    expect(init.body).not.toContain("user/private.md")
  })
})
