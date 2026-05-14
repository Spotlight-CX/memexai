import { z } from "zod"

export const contextSchema = z.object({
  userId: z.string().min(1),
  actor: z.string().min(1).optional(),
  toolCallId: z.string().min(1).optional(),
})

export const executeToolRequestSchema = z.object({
  context: contextSchema,
  arguments: z.unknown().default({}),
})

export const promptBlockQuerySchema = contextSchema

export const listArgsSchema = z.object({
  prefix: z.string().optional(),
})

export const readArgsSchema = z.object({
  path: z.string().min(1),
})

export const writeArgsSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  reason: z.string().optional(),
})

export const patchArgsSchema = z.discriminatedUnion("operation", [
  z.object({
    path: z.string().min(1),
    operation: z.literal("append_lines"),
    after_heading: z.string().min(1),
    lines: z.array(z.string()).min(1),
    reason: z.string().optional(),
  }),
  z.object({
    path: z.string().min(1),
    operation: z.literal("replace_lines"),
    match: z.string().min(1),
    replacement: z.union([z.string(), z.array(z.string())]),
    reason: z.string().optional(),
  }),
])

export const smartReadArgsSchema = z.object({
  maxChars: z.number().int().positive().max(200_000).default(24_000).optional(),
  query: z.string().min(1).optional(),
})
