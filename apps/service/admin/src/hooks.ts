import { useEffect, useState } from "react"

export function useAdminData<T>(path: string | null, secret: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    fetch(path, { headers: { "x-memex-admin-secret": secret } })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error?.message ?? "Request failed")
        return body as T
      })
      .then((body) => {
        if (!cancelled) { setData(body); setError(null) }
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "Request failed")
      })
    return () => { cancelled = true }
  }, [path, secret])

  return { data, error }
}
