import { describe, expect, test } from "vitest"
import {
  listArgsSchema,
  rememberArgsSchema,
  patchArgsSchema,
  readArgsSchema,
  findArgsSchema,
  contextArgsSchema,
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

describe("contextArgsSchema", () => {
  test("accepts defaults and optional query", () => {
    expect(contextArgsSchema.parse({})).toEqual({ maxChars: 24000, relatedDepth: 1 })
    expect(contextArgsSchema.parse({
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
    expect(() => contextArgsSchema.parse({ maxChars: 0 })).toThrow()
    expect(() => contextArgsSchema.parse({ query: "" })).toThrow()
    expect(() => contextArgsSchema.parse({ relatedDepth: -1 })).toThrow()
    expect(() => contextArgsSchema.parse({ relatedDepth: 3 })).toThrow()
  })
})

describe("findArgsSchema", () => {
  test("requires a non-empty query", () => {
    expect(() => findArgsSchema.parse({})).toThrow()
    expect(() => findArgsSchema.parse({ query: "" })).toThrow()
  })

  test("rejects invalid numeric bounds", () => {
    expect(() => findArgsSchema.parse({ query: "x", limit: -1 })).toThrow()
    expect(() => findArgsSchema.parse({ query: "x", maxChars: 0 })).toThrow()
  })
})

describe("rememberArgsSchema", () => {
  test("requires non-empty text", () => {
    expect(() => rememberArgsSchema.parse({})).toThrow()
    expect(() => rememberArgsSchema.parse({ text: "" })).toThrow()
  })

  test("rejects invalid maxWrites", () => {
    expect(() => rememberArgsSchema.parse({ text: "remember this", maxWrites: 0 })).toThrow()
  })
})
