import { describe, expect, test } from "vitest"
import {
  listArgsSchema,
  memorizeArgsSchema,
  patchArgsSchema,
  readArgsSchema,
  searchArgsSchema,
  smartReadArgsSchema,
  writeArgsSchema,
} from "../src/schemas"

describe("listArgsSchema", () => {
  test("accepts empty object", () => {
    expect(() => listArgsSchema.parse({})).not.toThrow()
  })
  test("accepts optional prefix", () => {
    const result = listArgsSchema.parse({ prefix: "user/" })
    expect(result.prefix).toBe("user/")
  })
})

describe("readArgsSchema", () => {
  test("requires a non-empty path", () => {
    expect(() => readArgsSchema.parse({ path: "" })).toThrow()
    expect(() => readArgsSchema.parse({})).toThrow()
  })
  test("accepts valid path", () => {
    expect(readArgsSchema.parse({ path: "user/profile.md" })).toMatchObject({ path: "user/profile.md" })
  })
})

describe("writeArgsSchema", () => {
  test("requires path and content", () => {
    expect(() => writeArgsSchema.parse({ path: "user/f.md" })).toThrow()
    expect(() => writeArgsSchema.parse({ content: "x" })).toThrow()
  })
  test("accepts optional reason", () => {
    const result = writeArgsSchema.parse({ path: "user/f.md", content: "hi", reason: "test" })
    expect(result.reason).toBe("test")
  })
})

describe("patchArgsSchema", () => {
  test("validates append_lines operation", () => {
    const result = patchArgsSchema.parse({
      path: "user/f.md",
      operation: "append_lines",
      after_heading: "## Preferences",
      lines: ["- item"],
    })
    expect(result.operation).toBe("append_lines")
  })

  test("allows append_lines without after_heading for EOF append", () => {
    const result = patchArgsSchema.parse({
      path: "user/log.md",
      operation: "append_lines",
      lines: ["- log entry"],
    })
    expect(result).toMatchObject({ operation: "append_lines", lines: ["- log entry"] })
  })

  test("validates replace_lines operation with string replacement", () => {
    const result = patchArgsSchema.parse({
      path: "user/f.md",
      operation: "replace_lines",
      match: "old",
      replacement: "new",
    })
    expect(result.operation).toBe("replace_lines")
  })

  test("validates replace_lines with array replacement", () => {
    const result = patchArgsSchema.parse({
      path: "user/f.md",
      operation: "replace_lines",
      match: "old",
      replacement: ["line1", "line2"],
    })
    expect(Array.isArray(result.replacement)).toBe(true)
  })

  test("rejects unknown operation", () => {
    expect(() =>
      patchArgsSchema.parse({ path: "user/f.md", operation: "delete", match: "x" }),
    ).toThrow()
  })

  test("requires at least one line for append_lines", () => {
    expect(() =>
      patchArgsSchema.parse({
        path: "user/f.md",
        operation: "append_lines",
        after_heading: "## H",
        lines: [],
      }),
    ).toThrow()
  })
})

describe("smartReadArgsSchema", () => {
  test("accepts defaults and optional query", () => {
    expect(smartReadArgsSchema.parse({})).toEqual({ maxChars: 24000, relatedDepth: 1 })
    expect(smartReadArgsSchema.parse({
      maxChars: 100,
      query: "budget",
      includeRelated: true,
      relatedDepth: 2,
    })).toMatchObject({
      maxChars: 100,
      query: "budget",
      includeRelated: true,
      relatedDepth: 2,
    })
  })

  test("rejects invalid bounds", () => {
    expect(() => smartReadArgsSchema.parse({ maxChars: 0 })).toThrow()
    expect(() => smartReadArgsSchema.parse({ query: "" })).toThrow()
    expect(() => smartReadArgsSchema.parse({ relatedDepth: -1 })).toThrow()
    expect(() => smartReadArgsSchema.parse({ relatedDepth: 3 })).toThrow()
  })
})

describe("searchArgsSchema", () => {
  test("requires a non-empty query", () => {
    expect(() => searchArgsSchema.parse({})).toThrow()
    expect(() => searchArgsSchema.parse({ query: "" })).toThrow()
  })

  test("rejects invalid numeric bounds", () => {
    expect(() => searchArgsSchema.parse({ query: "x", limit: -1 })).toThrow()
    expect(() => searchArgsSchema.parse({ query: "x", maxReads: 0 })).toThrow()
    expect(() => searchArgsSchema.parse({ query: "x", maxChars: 0 })).toThrow()
  })
})

describe("memorizeArgsSchema", () => {
  test("requires non-empty text", () => {
    expect(() => memorizeArgsSchema.parse({})).toThrow()
    expect(() => memorizeArgsSchema.parse({ text: "" })).toThrow()
  })

  test("rejects invalid maxWrites", () => {
    expect(() => memorizeArgsSchema.parse({ text: "remember this", maxWrites: 0 })).toThrow()
  })
})
