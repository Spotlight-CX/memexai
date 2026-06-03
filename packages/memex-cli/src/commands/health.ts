import type { Client } from "../client"

export async function cmdHealth(client: Client): Promise<unknown> {
  return client.get("/v1/admin/health")
}
