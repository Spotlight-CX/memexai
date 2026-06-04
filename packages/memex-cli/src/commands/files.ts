import type { Client } from "../client"

export interface FilesArgs {
  path?: string
  prefix?: string
  asOf?: string
  write?: string
  reason?: string
}

export async function cmdFiles(client: Client, args: FilesArgs): Promise<unknown> {
  if (args.write !== undefined) {
    if (!args.path) throw new Error("--write requires a path argument: memex-cli files <path> --write <content>")
    return client.put(`/v1/admin/files/${args.path}`, { content: args.write, reason: args.reason })
  }

  if (args.path) {
    return client.get(`/v1/admin/files/${args.path}`, { asOf: args.asOf })
  }

  return client.get("/v1/admin/files", { prefix: args.prefix, asOf: args.asOf })
}
