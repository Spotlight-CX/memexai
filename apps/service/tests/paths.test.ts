import { describe, expect, test } from "vitest"
import { assertWritableVirtualPath, physicalToVirtual, virtualToPhysical } from "../src/paths"
import { HttpError } from "../src/errors"

const ctx = { userId: "user_123", actor: "assistant" }

describe("path translation", () => {
  test("maps user virtual paths to physical user paths", () => {
    expect(virtualToPhysical("user/profile.md", ctx)).toBe("users/user_123/profile.md")
  })

  test("leaves shared paths in shared physical space", () => {
    expect(virtualToPhysical("shared/claude.md", ctx)).toBe("shared/claude.md")
  })

  test("maps only current user physical paths back to virtual paths", () => {
    expect(physicalToVirtual("users/user_123/profile.md", ctx)).toBe("user/profile.md")
    expect(physicalToVirtual("users/other/profile.md", ctx)).toBeNull()
  })

  test("rejects unsafe paths", () => {
    expect(() => virtualToPhysical("../profile.md", ctx)).toThrow(HttpError)
    expect(() => virtualToPhysical("/user/profile.md", ctx)).toThrow(HttpError)
    expect(() => virtualToPhysical("user//profile.md", ctx)).toThrow(HttpError)
    expect(() => virtualToPhysical("users/user_123/profile.md", ctx)).toThrow(HttpError)
  })

  test("allows writes only under user mount", () => {
    expect(() => assertWritableVirtualPath("user/profile.md")).not.toThrow()
    expect(() => assertWritableVirtualPath("shared/claude.md")).toThrow(/shared/)
  })
})
