import { createReadStream } from "node:fs"
import { access } from "node:fs/promises"
import { dirname, extname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"
import Fastify, { type FastifyReply } from "fastify"
import { createPool, runMigrations } from "@memexai/core"
import {
  getAdminFile,
  listAdminAccessLogs,
  listAdminFiles,
  listAdminRevisions,
  listAdminUsers,
  writeAdminFile,
} from "./admin"

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
}

async function sendAdminAsset(reply: FastifyReply, adminDistDir: string, assetPath: string) {
  const safePath = normalize(assetPath).replace(/^(\.\.(\/|\\|$))+/, "")
  const filePath = join(adminDistDir, safePath)
  try {
    await access(filePath)
  } catch {
    if (!assetPath.includes(".")) {
      reply.type("text/html; charset=utf-8")
      return reply.send(createReadStream(join(adminDistDir, "index.html")))
    }
    reply.code(404)
    return reply.send({ error: { code: "NOT_FOUND", message: "Asset not found" } })
  }
  const contentType = contentTypes[extname(filePath)] ?? "application/octet-stream"
  reply.type(contentType)
  return reply.send(createReadStream(filePath))
}

export async function startAdminServer(options: {
  databaseUrl: string
  port: number
  open: boolean
}) {
  const db = createPool(options.databaseUrl)
  await runMigrations(db)

  const app = Fastify({ logger: false })
  const adminDistDir = join(dirname(fileURLToPath(import.meta.url)), "..", "admin-dist")

  app.get("/health", async () => ({ ok: true }))
  app.get("/v1/admin/health", async () => ({ ok: true, admin: true }))

  app.get("/v1/admin/users", async () => listAdminUsers(db))
  app.get("/v1/admin/files", async (request) => {
    const query = request.query as { prefix?: string }
    return listAdminFiles(db, { prefix: query.prefix })
  })
  app.get("/v1/admin/files/*", async (request, reply) => {
    const params = request.params as { "*": string }
    const result = await getAdminFile(db, decodeURIComponent(params["*"]))
    if (!result) {
      reply.code(404)
      return { error: { code: "FILE_NOT_FOUND", message: "File not found" } }
    }
    return result
  })
  app.put("/v1/admin/files/*", async (request) => {
    const params = request.params as { "*": string }
    const { content, reason } = request.body as { content: string; reason?: string }
    return writeAdminFile(db, decodeURIComponent(params["*"]), content, reason)
  })
  app.get("/v1/admin/revisions", async (request) => {
    const query = request.query as { physicalPath?: string }
    return listAdminRevisions(db, { physicalPath: query.physicalPath })
  })
  app.get("/v1/admin/access-logs", async (request) => {
    const query = request.query as { physicalPath?: string }
    return listAdminAccessLogs(db, { physicalPath: query.physicalPath })
  })

  app.get("/", async (_request, reply) => reply.redirect("/admin"))
  app.get("/admin", async (_request, reply) => sendAdminAsset(reply, adminDistDir, "index.html"))
  app.get("/admin/*", async (request, reply) => {
    const params = request.params as { "*": string }
    return sendAdminAsset(reply, adminDistDir, params["*"] || "index.html")
  })

  await app.listen({ port: options.port, host: "127.0.0.1" })

  const url = `http://localhost:${options.port}/admin`
  console.log(`\n  memex-admin running at ${url}\n`)

  if (options.open) {
    const { exec } = await import("node:child_process")
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
    exec(`${opener} ${url}`)
  }

  return url
}
