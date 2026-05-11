import { describe, expect, test } from "vitest"
import { appendLinesAfterHeading, replaceExactText } from "../src/text-patch"
import { MemexError } from "../src/errors"

describe("appendLinesAfterHeading", () => {
  test("appends lines under a markdown heading", () => {
    const result = appendLinesAfterHeading(
      "# Profile\n\n## Stable Preferences\n",
      "## Stable Preferences",
      ["- Prefers quiet neighborhoods"],
    )
    expect(result.changed).toBe(true)
    expect(result.content).toContain("- Prefers quiet neighborhoods")
  })

  test("does not duplicate an existing line in the same section", () => {
    const result = appendLinesAfterHeading(
      "# Profile\n\n## Stable Preferences\n\n- Prefers quiet neighborhoods\n",
      "## Stable Preferences",
      ["- Prefers quiet neighborhoods"],
    )
    expect(result.changed).toBe(false)
  })

  test("stops before the next heading at the same or higher level", () => {
    const content = "# Profile\n\n## Preferences\n\nold line\n\n## Other\n"
    const result = appendLinesAfterHeading(content, "## Preferences", ["new line"])
    expect(result.changed).toBe(true)
    const prefIdx = result.content.indexOf("## Preferences")
    const otherIdx = result.content.indexOf("## Other")
    const newIdx = result.content.indexOf("new line")
    expect(newIdx).toBeGreaterThan(prefIdx)
    expect(newIdx).toBeLessThan(otherIdx)
  })

  test("throws if heading not found", () => {
    try {
      appendLinesAfterHeading("# Profile\n", "## Missing", ["line"])
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(MemexError)
      expect((err as MemexError).code).toBe("PATCH_HEADING_NOT_FOUND")
    }
  })

  test("handles CRLF line endings", () => {
    const result = appendLinesAfterHeading(
      "# Profile\r\n\r\n## Prefs\r\n",
      "## Prefs",
      ["- new item"],
    )
    expect(result.changed).toBe(true)
    expect(result.content).toContain("- new item")
  })
})

describe("replaceExactText", () => {
  test("replaces an exact match", () => {
    const result = replaceExactText("Budget: 2 Cr\n", "2 Cr", "2.5 Cr")
    expect(result.content).toBe("Budget: 2.5 Cr\n")
    expect(result.changed).toBe(true)
  })

  test("accepts array replacement joined with newlines", () => {
    const result = replaceExactText("old", "old", ["line1", "line2"])
    expect(result.content).toBe("line1\nline2")
    expect(result.changed).toBe(true)
  })

  test("is a no-op when replacement equals match", () => {
    const result = replaceExactText("same text\n", "same text", "same text")
    expect(result.changed).toBe(false)
  })

  test("throws when match not found", () => {
    try {
      replaceExactText("hello", "missing", "x")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(MemexError)
      expect((err as MemexError).code).toBe("PATCH_MATCH_NOT_FOUND")
    }
  })

  test("throws when match is ambiguous (multiple occurrences)", () => {
    try {
      replaceExactText("a a a", "a", "b")
      expect.fail("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(MemexError)
      expect((err as MemexError).code).toBe("PATCH_AMBIGUOUS_MATCH")
    }
  })
})
