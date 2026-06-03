import type { Client } from "../client"

export interface DocsArgs {
  path?: string
  list?: boolean
  raw?: boolean
}

export async function cmdDocs(client: Client, args: DocsArgs): Promise<unknown> {
  if (args.list || !args.path) {
    return client.get("/v1/docs", undefined, false)
  }

  const result = await client.get<{ path: string; content: string; size: number; updatedAt: string }>(
    `/v1/docs/${args.path}`,
    undefined,
    false,
  )

  if (args.raw) {
    process.stdout.write(result.content)
    process.exit(0)
  }

  return result
}
