import type { Client } from "../client"

export interface DreamArgs {
  user?: string
  status?: string
  from?: string
  to?: string
  limit?: number
  run?: boolean
  pause?: boolean
  unpause?: boolean
}

export async function cmdDream(client: Client, args: DreamArgs): Promise<unknown> {
  if (args.run) {
    return client.post("/v1/admin/dream/run", args.user ? { userId: args.user } : undefined)
  }

  if (args.pause !== undefined || args.unpause !== undefined) {
    if (!args.user) throw new Error("--pause / --unpause require --user <userId>")
    const paused = args.pause === true
    return client.put(`/v1/admin/dream/users/${encodeURIComponent(args.user)}/paused`, { paused })
  }

  return client.get("/v1/admin/dream/users", {
    q: args.user,
    status: args.status,
    from: args.from,
    to: args.to,
    limit: args.limit,
  })
}
