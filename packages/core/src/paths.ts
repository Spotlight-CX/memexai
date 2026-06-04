import { MemexError } from "./errors"

export type ToolContext = {
  userId: string
  actor?: string
  toolCallId?: string
}

export type SharedWriteMode = "read_only" | "rw"

export type MemoryPermissions = {
  sharedWriteMode: SharedWriteMode
  writableMounts: string[]
  readOnlyMounts: string[]
}

export function resolveMemoryPermissions(input: { sharedWriteMode?: SharedWriteMode } = {}): MemoryPermissions {
  const sharedWriteMode = input.sharedWriteMode ?? "read_only"
  return {
    sharedWriteMode,
    writableMounts: sharedWriteMode === "rw" ? ["user", "shared"] : ["user"],
    readOnlyMounts: sharedWriteMode === "rw" ? [] : ["shared"],
  }
}

export function validateVirtualPath(path: string): void {
  if (!path || typeof path !== "string") {
    throw new MemexError("INVALID_PATH", "path is required")
  }

  if (path.startsWith("/") || path.includes("\\") || path.includes("//")) {
    throw new MemexError("INVALID_PATH", "Path must be a relative slash-delimited path")
  }

  const segments = path.split("/")
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new MemexError("INVALID_PATH", "Path cannot contain empty, dot, or dot-dot segments")
  }

  if (segments[0] === "users") {
    throw new MemexError("PHYSICAL_PATH_FORBIDDEN", "Agents cannot use physical users/{userId} paths")
  }
}

export function virtualToPhysical(path: string, ctx: ToolContext): string {
  validateVirtualPath(path)

  if (path === "user" || path.startsWith("user/")) {
    if (!ctx.userId) {
      throw new MemexError("USER_ID_REQUIRED", "userId is required for user/** memory paths")
    }
    return path === "user" ? `users/${ctx.userId}` : `users/${ctx.userId}/${path.slice("user/".length)}`
  }

  if (path === "shared" || path.startsWith("shared/")) {
    return path
  }

  throw new MemexError("UNKNOWN_MOUNT", "Path must start with user/ or shared/")
}

export function physicalToVirtual(physicalPath: string, ctx: ToolContext): string | null {
  if (physicalPath.startsWith(`users/${ctx.userId}/`)) {
    return `user/${physicalPath.slice(`users/${ctx.userId}/`.length)}`
  }

  if (physicalPath === `users/${ctx.userId}`) {
    return "user"
  }

  if (physicalPath === "shared" || physicalPath.startsWith("shared/")) {
    return physicalPath
  }

  return null
}

export function assertWritableVirtualPath(path: string, permissions: MemoryPermissions = resolveMemoryPermissions()): void {
  validateVirtualPath(path)
  if (path === "user" || path.startsWith("user/")) return
  if ((path === "shared" || path.startsWith("shared/")) && permissions.writableMounts.includes("shared")) return
  if (path === "shared" || path.startsWith("shared/")) {
    throw new MemexError("READ_ONLY_MOUNT", "Agents cannot write to shared/**")
  }
  throw new MemexError("UNKNOWN_MOUNT", "Path must start with user/ or shared/")
}

export function prefixToPhysical(prefix: string | undefined, ctx: ToolContext): string | null {
  if (!prefix) return null
  const normalized = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix
  return virtualToPhysical(normalized, ctx)
}
