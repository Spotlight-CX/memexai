import { describe, expect, test } from "vitest"
import { appendLinesAfterHeading, replaceExactText } from "../src/text-patch"

describe("text patch helpers", () => {
  test("appends lines under a markdown heading", () => {
    const result = appendLinesAfterHeading("# Profile\n\n## Stable Preferences\n", "## Stable Preferences", [
      "- Prefers quieter neighborhoods",
    ])

    expect(result.changed).toBe(true)
    expect(result.content).toContain("- Prefers quieter neighborhoods")
  })

  test("does not duplicate an existing line in the same section", () => {
    const result = appendLinesAfterHeading(
      "# Profile\n\n## Stable Preferences\n\n- Prefers quieter neighborhoods\n",
      "## Stable Preferences",
      ["- Prefers quieter neighborhoods"],
    )

    expect(result.changed).toBe(false)
  })

  test("replaces exact text only when unambiguous", () => {
    const result = replaceExactText("Budget: 2 Cr\n", "2 Cr", "2.5 Cr")
    expect(result.content).toBe("Budget: 2.5 Cr\n")
  })
})
