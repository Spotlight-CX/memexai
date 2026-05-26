async function parseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return null
  return response.json().catch(() => null)
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const body = await parseBody(response)

  if (!response.ok) {
    const message = body?.error?.message ?? `HTTP ${response.status}`
    throw new Error(message)
  }

  return body as T
}

export function adminHeaders(secret: string): HeadersInit {
  return { "x-memex-admin-secret": secret }
}

export function apiHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` }
}
