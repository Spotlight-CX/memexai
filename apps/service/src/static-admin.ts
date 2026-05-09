import { createReadStream } from "node:fs"
import { access } from "node:fs/promises"
import { dirname, extname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"
import type { FastifyInstance, FastifyReply } from "fastify"

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
}

function adminDistDir() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "admin", "dist")
}

export function registerAdminStaticRoutes(app: FastifyInstance) {
  app.get("/admin", async (_request, reply) => {
    return sendAdminAsset(reply, "index.html")
  })

  app.get("/admin/*", async (request, reply) => {
    const params = request.params as { "*": string }
    const assetPath = params["*"] || "index.html"
    return sendAdminAsset(reply, assetPath)
  })
}

async function sendAdminAsset(reply: FastifyReply, assetPath: string) {
  const safePath = normalize(assetPath).replace(/^(\.\.(\/|\\|$))+/, "")
  const filePath = join(adminDistDir(), safePath)

  try {
    await access(filePath)
  } catch {
    if (!assetPath.includes(".")) {
      return sendAdminAsset(reply, "index.html")
    }

    reply.code(404)
    return reply.send({ error: { code: "ADMIN_ASSET_NOT_FOUND", message: "Admin asset not found" } })
  }

  const contentType = contentTypes[extname(filePath)] ?? "application/octet-stream"
  reply.type(contentType)
  return reply.send(createReadStream(filePath))
}
