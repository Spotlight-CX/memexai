import type { FastifyReply, FastifyRequest } from "fastify"
import { HttpError } from "./errors"

export function requireApiKey(expected: string) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const auth = request.headers.authorization
    if (auth !== `Bearer ${expected}`) {
      throw new HttpError(401, "UNAUTHORIZED", "Missing or invalid API key")
    }
  }
}

export function requireAdminSecret(expected: string) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const secret = request.headers["x-memex-admin-secret"]
    if (secret !== expected) {
      throw new HttpError(401, "UNAUTHORIZED_ADMIN", "Missing or invalid admin secret")
    }
  }
}
