import { useQuery } from "@tanstack/react-query"

export const adminQueryKey = (path: string) => ["admin", path]

export function useAdminData<T>(path: string | null, secret: string, options: { refetchInterval?: number | false } = {}) {
  const { data, error } = useQuery<T, Error>({
    queryKey: adminQueryKey(path ?? ""),
    queryFn: async () => {
      const res = await fetch(path!, { headers: { "x-memex-admin-secret": secret } })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error?.message ?? "Request failed")
      return body as T
    },
    enabled: !!path && !!secret,
    refetchInterval: options.refetchInterval,
  })
  return { data: data ?? null, error: error?.message ?? null }
}
