import { z } from "zod"

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
    after_heading: z.string().min(1).optional(),
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
  includeRelated: z.boolean().optional(),
  relatedDepth: z.number().int().min(0).max(2).default(1).optional(),
})

export const searchArgsSchema = z.object({
  query: z.string().min(1),
  maxChars: z.number().int().positive().max(200_000).default(8_000).optional(),
  limit: z.number().int().positive().max(100).default(10).optional(),
  maxReads: z.number().int().positive().max(50).default(5).optional(),
  prefix: z.string().optional(),
})

export const memorizeArgsSchema = z.object({
  text: z.string().min(1),
  maxWrites: z.number().int().positive().max(50).default(5).optional(),
  maxReads: z.number().int().min(0).max(20).default(3).optional(),
  dryRun: z.boolean().default(false).optional(),
})
