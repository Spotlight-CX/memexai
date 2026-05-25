import { useMutation, useQuery } from "@tanstack/react-query"
import { adminHeaders, apiHeaders, requestJson } from "./api"
import type { AdminUser } from "./types"
import type { RunResult, ToolDef } from "./components/tool-utils"

type UsersResponse = { users: AdminUser[] }
type ToolsResponse = { tools: ToolDef[] }
type RunToolInput = {
  toolName: string
  userId: string
  args: Record<string, unknown>
}

export function useAdminUsersQuery({
  secret,
  q,
  limit,
  enabled = true,
}: {
  secret: string
  q?: string
  limit?: number
  enabled?: boolean
}) {
  const query = new URLSearchParams()
  if (q?.trim()) query.set("q", q.trim())
  if (limit) query.set("limit", String(limit))
  const suffix = query.toString()

  return useQuery({
    queryKey: ["admin-users", secret, q?.trim() ?? "", limit ?? null],
    enabled: enabled && Boolean(secret),
    staleTime: 15_000,
    queryFn: () => requestJson<UsersResponse>(
      `/v1/admin/users${suffix ? `?${suffix}` : ""}`,
      { headers: adminHeaders(secret) },
    ),
  })
}

export function useToolsQuery({
  apiKey,
  onApiKeyInvalid,
}: {
  apiKey: string
  onApiKeyInvalid: () => void
}) {
  return useQuery({
    queryKey: ["tools", apiKey],
    enabled: Boolean(apiKey),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch("/v1/tools", { headers: apiHeaders(apiKey) })
      if (response.status === 401 || response.status === 403) {
        onApiKeyInvalid()
        return { tools: [] }
      }
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
      return body as ToolsResponse
    },
  })
}

export function useRunToolMutation({ apiKey }: { apiKey: string }) {
  return useMutation({
    mutationFn: async ({ toolName, userId, args }: RunToolInput): Promise<RunResult> => {
      const start = Date.now()
      try {
        const response = await fetch(`/v1/tools/${toolName}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...apiHeaders(apiKey) },
          body: JSON.stringify({
            context: { userId: userId.trim() || "demo_user" },
            arguments: args,
          }),
        })
        const body = await response.json().catch(() => ({}))
        return { status: response.status, latency: Date.now() - start, body }
      } catch (error) {
        return {
          status: 0,
          latency: Date.now() - start,
          body: { error: error instanceof Error ? error.message : "Network error" },
        }
      }
    },
  })
}
