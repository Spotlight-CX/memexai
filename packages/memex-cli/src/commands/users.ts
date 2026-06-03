import type { Client } from "../client"

export interface UsersArgs {
  q?: string
  limit?: number
}

export async function cmdUsers(client: Client, args: UsersArgs): Promise<unknown> {
  return client.get("/v1/admin/users", { q: args.q, limit: args.limit })
}
