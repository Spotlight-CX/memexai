import type { Client } from "../client"

export interface HistoryArgs {
  path?: string
  user?: string
  toolCall?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
  type?: "revisions" | "logs" | "events"
}

export async function cmdHistory(client: Client, args: HistoryArgs): Promise<unknown> {
  const type = args.type ?? "revisions+logs"

  if (type === "revisions") {
    return client.get("/v1/admin/revisions", {
      physicalPath: args.path,
      userId: args.user,
      from: args.from,
      to: args.to,
      limit: args.limit,
      offset: args.offset,
    })
  }

  if (type === "logs") {
    return client.get("/v1/admin/access-logs", {
      physicalPath: args.path,
      userId: args.user,
      toolCallId: args.toolCall,
      from: args.from,
      to: args.to,
      limit: args.limit,
      offset: args.offset,
    })
  }

  if (type === "events") {
    return client.get("/v1/admin/observability/events", {
      physicalPath: args.path,
      userId: args.user,
      toolCallId: args.toolCall,
      from: args.from,
      to: args.to,
      limit: args.limit,
      offset: args.offset,
    })
  }

  // Default: merge revisions + access logs
  const [revisions, logs] = await Promise.all([
    client.get<{ revisions: unknown[] }>("/v1/admin/revisions", {
      physicalPath: args.path,
      userId: args.user,
      from: args.from,
      to: args.to,
      limit: args.limit,
      offset: args.offset,
    }),
    client.get<{ accessLogs: unknown[] }>("/v1/admin/access-logs", {
      physicalPath: args.path,
      userId: args.user,
      toolCallId: args.toolCall,
      from: args.from,
      to: args.to,
      limit: args.limit,
      offset: args.offset,
    }),
  ])

  return { revisions: revisions.revisions, accessLogs: logs.accessLogs }
}
