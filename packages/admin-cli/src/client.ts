import {
  createPool,
  runMigrations,
  listAdminUsers,
  listAdminFiles,
  getAdminFile,
  writeAdminFile,
  listAdminRevisions,
  pruneAdminRevisions,
  getRevisionAtOffset,
  listAdminAccessLogs,
  listAdminDreamUsers,
  getMemorySnapshot,
  getAgenticTrace,
  listAgenticTraceSession,
  getAdminSetupStatus,
  writeAdminSetupComplete,
} from "@memexai/core"
import type { Db } from "@memexai/core"

// ─── Shared option types (used by both direct and HTTP clients) ───────────────

export type ListUsersOpts = { q?: string; limit?: number }
export type ListFilesOpts = { prefix?: string }
export type ListRevisionsOpts = {
  physicalPath?: string; actor?: string; userId?: string
  from?: string; to?: string; limit?: number; offset?: number
}
export type ListLogsOpts = {
  physicalPath?: string; userId?: string; toolCallId?: string
  from?: string; to?: string; limit?: number; offset?: number
}
export type ListDreamOpts = {
  status?: string; q?: string; from?: string; to?: string; limit?: number; offset?: number
}
export type ListTraceSessionOpts = { userId: string; from?: string; limit?: number }

// ─── AdminClient interface ────────────────────────────────────────────────────

export interface AdminClient {
  readonly mode: "direct" | "http"
  listUsers(opts?: ListUsersOpts): Promise<unknown>
  listFiles(opts?: ListFilesOpts): Promise<unknown>
  getFile(path: string): Promise<unknown>
  writeFile(path: string, content: string, reason?: string): Promise<unknown>
  listRevisions(opts?: ListRevisionsOpts): Promise<unknown>
  pruneRevisions(olderThanDays: number): Promise<unknown>
  getRevisionAtOffset(path: string, offset: number): Promise<unknown>
  listAccessLogs(opts?: ListLogsOpts): Promise<unknown>
  listDreamUsers(opts?: ListDreamOpts): Promise<unknown>
  getMemorySnapshot(userId: string, asOf?: string): Promise<unknown>
  getAgenticTrace(toolCallId: string): Promise<unknown>
  listTraceSession(opts: ListTraceSessionOpts): Promise<unknown>
  getSetupStatus(): Promise<unknown>
  writeSetupComplete(note?: string): Promise<unknown>
  /** Raw HTTP request — HTTP mode only */
  rawRequest(method: string, path: string, body?: unknown): Promise<unknown>
  close(): Promise<void>
}

// ─── Direct (Postgres) client ─────────────────────────────────────────────────

class DirectAdminClient implements AdminClient {
  readonly mode = "direct" as const
  private db: Db

  constructor(databaseUrl: string) {
    this.db = createPool(databaseUrl)
  }

  async init() {
    await runMigrations(this.db)
  }

  listUsers(opts?: ListUsersOpts) { return listAdminUsers(this.db, opts) }
  listFiles(opts?: ListFilesOpts) { return listAdminFiles(this.db, opts ?? {}) }
  getFile(path: string) { return getAdminFile(this.db, path) }
  writeFile(path: string, content: string, reason?: string) { return writeAdminFile(this.db, path, content, reason) }
  listRevisions(opts?: ListRevisionsOpts) { return listAdminRevisions(this.db, opts) }
  pruneRevisions(olderThanDays: number) { return pruneAdminRevisions(this.db, { olderThanDays }) }
  getRevisionAtOffset(path: string, offset: number) { return getRevisionAtOffset(this.db, path, offset) }
  listAccessLogs(opts?: ListLogsOpts) { return listAdminAccessLogs(this.db, opts) }
  listDreamUsers(opts?: ListDreamOpts) { return listAdminDreamUsers(this.db, opts) }
  getMemorySnapshot(userId: string, asOf?: string) {
    return getMemorySnapshot(this.db, userId, asOf ? new Date(asOf) : undefined)
  }
  getAgenticTrace(toolCallId: string) { return getAgenticTrace(this.db, toolCallId) }
  listTraceSession(opts: ListTraceSessionOpts) { return listAgenticTraceSession(this.db, opts) }
  getSetupStatus() { return getAdminSetupStatus(this.db) }
  writeSetupComplete(note?: string) { return writeAdminSetupComplete(this.db, note) }
  rawRequest(_method: string, _path: string, _body?: unknown): Promise<unknown> {
    return Promise.reject(new Error("rawRequest is only available in HTTP mode (--service-url)"))
  }
  async close() { await this.db.end() }
}

// ─── HTTP (service proxy) client ──────────────────────────────────────────────

class HttpAdminClient implements AdminClient {
  readonly mode = "http" as const

  constructor(
    private serviceUrl: string,
    private adminSecret: string,
  ) {}

  private async fetch(method: string, path: string, params?: Record<string, string | number | boolean | undefined>, body?: unknown): Promise<unknown> {
    const url = new URL(path, this.serviceUrl)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
      }
    }
    const res = await fetch(url.toString(), {
      method,
      headers: {
        "x-memex-admin-secret": this.adminSecret,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`)
    }
    return res.json()
  }

  listUsers(opts?: ListUsersOpts) {
    return this.fetch("GET", "/v1/admin/users", { q: opts?.q, limit: opts?.limit })
  }
  listFiles(opts?: ListFilesOpts) {
    return this.fetch("GET", "/v1/admin/files", { prefix: opts?.prefix })
  }
  getFile(path: string) {
    return this.fetch("GET", `/v1/admin/files/${encodePath(path)}`)
  }
  writeFile(path: string, content: string, reason?: string) {
    return this.fetch("PUT", `/v1/admin/files/${encodePath(path)}`, undefined, { content, reason })
  }
  listRevisions(opts?: ListRevisionsOpts) {
    return this.fetch("GET", "/v1/admin/revisions", opts as Record<string, string | number | boolean | undefined>)
  }
  pruneRevisions(olderThanDays: number) {
    return this.fetch("POST", "/v1/admin/revisions/prune", undefined, { olderThanDays })
  }
  getRevisionAtOffset(_path: string, _offset: number): Promise<unknown> {
    return Promise.reject(new Error("revisions diff requires direct --database-url mode"))
  }
  listAccessLogs(opts?: ListLogsOpts) {
    return this.fetch("GET", "/v1/admin/access-logs", opts as Record<string, string | number | boolean | undefined>)
  }
  listDreamUsers(opts?: ListDreamOpts) {
    return this.fetch("GET", "/v1/admin/dream/users", opts as Record<string, string | number | boolean | undefined>)
  }
  getMemorySnapshot(_userId: string, _asOf?: string): Promise<unknown> {
    return Promise.reject(new Error("memory snapshot requires direct --database-url mode"))
  }
  getAgenticTrace(_toolCallId: string): Promise<unknown> {
    return Promise.reject(new Error("trace requires direct --database-url mode"))
  }
  listTraceSession(_opts: ListTraceSessionOpts): Promise<unknown> {
    return Promise.reject(new Error("trace session requires direct --database-url mode"))
  }
  getSetupStatus() {
    return this.fetch("GET", "/v1/admin/setup/status")
  }
  writeSetupComplete(note?: string) {
    return this.fetch("POST", "/v1/admin/setup/complete", undefined, { note })
  }
  rawRequest(method: string, path: string, body?: unknown) {
    return this.fetch(method.toUpperCase(), path, undefined, body)
  }
  async close() {}
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export type ClientOptions = {
  databaseUrl?: string
  serviceUrl?: string
  adminSecret?: string
  skipMigrations?: boolean
}

export async function createClient(opts: ClientOptions): Promise<AdminClient> {
  const serviceUrl = opts.serviceUrl ?? process.env["MEMEX_SERVICE_URL"]
  const databaseUrl = opts.databaseUrl ?? process.env["DATABASE_URL"] ?? process.env["MEMEX_DATABASE_URL"]
  const adminSecret = opts.adminSecret ?? process.env["MEMEX_ADMIN_SECRET"] ?? "dev-admin-secret"

  if (serviceUrl) {
    return new HttpAdminClient(serviceUrl, adminSecret)
  }

  if (databaseUrl) {
    const client = new DirectAdminClient(databaseUrl)
    if (!opts.skipMigrations) await client.init()
    return client
  }

  throw new Error(
    "No connection configured. Provide --database-url (or DATABASE_URL) for direct mode, " +
    "or --service-url (or MEMEX_SERVICE_URL) for HTTP proxy mode.",
  )
}

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/")
}
