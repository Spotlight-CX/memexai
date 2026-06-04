export interface ClientConfig {
  url: string
  secret?: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function buildClient(config: ClientConfig) {
  const base = config.url.replace(/\/$/, "")

  async function request<T>(
    method: string,
    path: string,
    options: { params?: Record<string, string | number | undefined>; body?: unknown; adminAuth?: boolean } = {},
  ): Promise<T> {
    const url = new URL(`${base}${path}`)
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v))
      }
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (options.adminAuth !== false && config.secret) {
      headers["x-admin-secret"] = config.secret
    }

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    if (!res.ok) {
      let code = "HTTP_ERROR"
      let message = `HTTP ${res.status}`
      try {
        const err = await res.json() as { error?: { code?: string; message?: string } }
        code = err?.error?.code ?? code
        message = err?.error?.message ?? message
      } catch { /* empty */ }
      throw new ApiError(res.status, code, message)
    }

    return res.json() as Promise<T>
  }

  return {
    get: <T>(path: string, params?: Record<string, string | number | undefined>, adminAuth = true) =>
      request<T>("GET", path, { params, adminAuth }),
    post: <T>(path: string, body?: unknown, adminAuth = true) =>
      request<T>("POST", path, { body, adminAuth }),
    put: <T>(path: string, body?: unknown, adminAuth = true) =>
      request<T>("PUT", path, { body, adminAuth }),
  }
}

export type Client = ReturnType<typeof buildClient>
