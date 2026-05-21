import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createConnectionScopedMcpServer } from "../src/mcp"
import { createMemoryDb } from "./mcp-helpers"

const { db } = createMemoryDb()
const server = createConnectionScopedMcpServer(db as never, {
  userId: "stdio_user",
  actor: "stdio-test",
})

await server.connect(new StdioServerTransport())
