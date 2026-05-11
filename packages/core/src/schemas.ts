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
