import { describe, expect, test } from "vitest"
import { assertWritableVirtualPath, physicalToVirtual, virtualToPhysical } from "../src/paths"
import { MemexError } from "../src/errors"

const ctx = { userId: "user_123", actor: "assistant" }

describe("path translation", () => {
  test("maps user virtual paths to physical user paths", () => {
    expect(virtualToPhysical("user/profile.md", ctx)).toBe("users/user_123/profile.md")
  })

  test("maps bare user mount", () => {
    expect(virtualToPhysical("user", ctx)).toBe("users/user_123")
  })

  test("leaves shared paths in shared physical space", () => {
    expect(virtualToPhysical("shared/claude.md", ctx)).toBe("shared/claude.md")
    expect(virtualToPhysical("shared", ctx)).toBe("shared")
  })

  test("maps only current user physical paths back to virtual paths", () => {
    expect(physicalToVirtual("users/user_123/profile.md", ctx)).toBe("user/profile.md")
    expect(physicalToVirtual("users/user_123", ctx)).toBe("user")
    expect(physicalToVirtual("users/other_user/profile.md", ctx)).toBeNull()
    expect(physicalToVirtual("shared/index.md", ctx)).toBe("shared/index.md")
  })

  test("rejects unsafe paths", () => {
    expect(() => virtualToPhysical("../profile.md", ctx)).toThrow(MemexError)
    expect(() => virtualToPhysical("/user/profile.md", ctx)).toThrow(MemexError)
    expect(() => virtualToPhysical("user//profile.md", ctx)).toThrow(MemexError)
    expect(() => virtualToPhysical("users/user_123/profile.md", ctx)).toThrow(MemexError)
    expect(() => virtualToPhysical("user/../etc/passwd", ctx)).toThrow(MemexError)
  })

  test("rejects unknown mount points", () => {
    expect(() => virtualToPhysical("tmp/profile.md", ctx)).toThrow(MemexError)
    expect(() => virtualToPhysical("global/config.md", ctx)).toThrow(MemexError)
  })

  test("allows writes only under user mount", () => {
    expect(() => assertWritableVirtualPath("user/profile.md")).not.toThrow()
    expect(() => assertWritableVirtualPath("user/nested/file.md")).not.toThrow()
    expect(() => assertWritableVirtualPath("shared/claude.md")).toThrow(MemexError)
    expect(() => assertWritableVirtualPath("shared/index.md")).toThrow(MemexError)
  })

  test("errors carry machine-readable codes", () => {
    try {
      virtualToPhysical("/bad", ctx)
    } catch (err) {
      expect(err).toBeInstanceOf(MemexError)
      expect((err as MemexError).code).toBe("INVALID_PATH")
    }
  })
})
