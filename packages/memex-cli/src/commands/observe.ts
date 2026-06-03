import type { Client } from "../client"

export interface ObserveArgs {
  user?: string
  from?: string
  to?: string
  tool?: string
  mode?: "summary" | "events" | "top" | "user"
  limit?: number
  offset?: number
}

export async function cmdObserve(client: Client, args: ObserveArgs): Promise<unknown> {
  const mode = args.mode ?? "summary"
  const params = {
    userId: args.user,
    from: args.from,
    to: args.to,
    toolName: args.tool,
    limit: args.limit,
    offset: args.offset,
  }

  if (mode === "events") return client.get("/v1/admin/observability/events", params)
  if (mode === "top") return client.get("/v1/admin/observability/top-files", params)
  if (mode === "user") return client.get("/v1/admin/observability/user", params)
  return client.get("/v1/admin/observability/summary", params)
}
