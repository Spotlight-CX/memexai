import type { Db } from "./db"
import { MemexError } from "./errors"
import { newId } from "./ids"
import { assertWritableVirtualPath, physicalToVirtual, prefixToPhysical, virtualToPhysical, type ToolContext } from "./paths"
import { appendLinesAfterHeading, replaceExactText } from "./text-patch"
import { listArgsSchema, memorizeArgsSchema, patchArgsSchema, readArgsSchema, searchArgsSchema, smartReadArgsSchema, writeArgsSchema } from "./schemas"
import { type ToolName } from "./tool-definitions"
import { generateText, jsonSchema, stepCountIs } from "ai"
import { isDreamExcludedPath } from "./dream-paths"

type FileRow = {
  id: string
  physical_path: string
  content_text: string
  created_at: Date
  updated_at: Date
}

async function logAccess(db: Db, input: {
  fileId?: string | null
  physicalPath: string
  operation: "list" | "read" | "write" | "patch" | "smart_read" | "search"
  ctx: ToolContext
}) {
  await db.query(
    `INSERT INTO mx_access_log (id, file_id, physical_path, operation, actor, user_id, tool_call_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      newId("log"),
      input.fileId ?? null,
      input.physicalPath,
      input.operation,
      input.ctx.actor ?? null,
      input.ctx.userId,
      input.ctx.toolCallId ?? null,
    ],
  )
}

async function insertRevision(db: Db, input: {
  fileId: string
  physicalPath: string
  operation: "write" | "patch"
  content: string
  reason?: string
  ctx: ToolContext
}) {
  await db.query(
    `INSERT INTO mx_revision (id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newId("rev"),
      input.fileId,
      input.physicalPath,
      input.operation,
      input.content,
      input.reason ?? null,
      input.ctx.actor ?? null,
      input.ctx.userId,
      input.ctx.toolCallId ?? null,
    ],
  )
}

export async function executeMemoryList(db: Db, args: unknown, ctx: ToolContext) {
  const { prefix } = listArgsSchema.parse(args ?? {})
  const physicalPrefix = prefixToPhysical(prefix, ctx)
  const values: unknown[] = []
  let where = "(physical_path = 'shared' OR physical_path LIKE 'shared/%' OR physical_path LIKE $1)"
  values.push(`users/${ctx.userId}/%`)

  if (physicalPrefix) {
    where = "physical_path = $1 OR physical_path LIKE $2"
    values.length = 0
    values.push(physicalPrefix, `${physicalPrefix.endsWith("/") ? physicalPrefix : `${physicalPrefix}/`}%`)
  }

  const { rows } = await db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE ${where}
     ORDER BY physical_path ASC`,
    values,
  )

  await logAccess(db, { physicalPath: physicalPrefix ?? "*", operation: "list", ctx })

  return {
    files: rows.flatMap((row) => {
      const virtualPath = physicalToVirtual(row.physical_path, ctx)
      if (!virtualPath) return []
      return [{
        path: virtualPath,
        size: row.content_text.length,
        updatedAt: row.updated_at,
      }]
    }),
  }
}

export async function executeMemoryRead(db: Db, args: unknown, ctx: ToolContext) {
  const { path } = readArgsSchema.parse(args)
  const physicalPath = virtualToPhysical(path, ctx)
  const { rows } = await db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = $1`,
    [physicalPath],
  )

  const file = rows[0]
  if (!file) throw new MemexError("FILE_NOT_FOUND", `File not found: ${path}`)

  await logAccess(db, { fileId: file.id, physicalPath, operation: "read", ctx })

  return {
    path,
    content: file.content_text,
    updatedAt: file.updated_at,
  }
}

export async function executeMemoryWrite(db: Db, args: unknown, ctx: ToolContext) {
  const { path, content, reason } = writeArgsSchema.parse(args)
  assertWritableVirtualPath(path)
  const physicalPath = virtualToPhysical(path, ctx)

  const { rows } = await db.query<{ id: string; created: boolean }>(
    `INSERT INTO mx_file (id, physical_path, content_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (physical_path)
     DO UPDATE SET content_text = EXCLUDED.content_text, updated_at = now()
     RETURNING id, (xmax = 0) AS created`,
    [newId("file"), physicalPath, content],
  )

  const file = rows[0]
  await insertRevision(db, { fileId: file.id, physicalPath, operation: "write", content, reason, ctx })
  await logAccess(db, { fileId: file.id, physicalPath, operation: "write", ctx })

  return {
    path,
    created: file.created,
    updated: !file.created,
  }
}

export async function executeMemoryPatch(db: Db, args: unknown, ctx: ToolContext) {
  const parsed = patchArgsSchema.parse(args)
  assertWritableVirtualPath(parsed.path)
  const physicalPath = virtualToPhysical(parsed.path, ctx)

  const { rows } = await db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = $1`,
    [physicalPath],
  )
  const file = rows[0]
  if (!file) throw new MemexError("FILE_NOT_FOUND", `File not found: ${parsed.path}`)

  const result = parsed.operation === "append_lines"
    ? appendLinesAfterHeading(file.content_text, parsed.after_heading, parsed.lines)
    : replaceExactText(file.content_text, parsed.match, parsed.replacement)

  if (result.changed) {
    await db.query("UPDATE mx_file SET content_text = $1, updated_at = now() WHERE id = $2", [result.content, file.id])
    await insertRevision(db, {
      fileId: file.id,
      physicalPath,
      operation: "patch",
      content: result.content,
      reason: parsed.reason,
      ctx,
    })
  }
  await logAccess(db, { fileId: file.id, physicalPath, operation: "patch", ctx })

  return {
    path: parsed.path,
    operation: parsed.operation,
    changed: result.changed,
    noOp: !result.changed,
  }
}

type SmartReadRow = FileRow & {
  rank?: number
}

type MemoryContextReason = "query_match" | "recency" | "linked"

type MemoryContextFile = {
  path: string
  content: string
  updatedAt: Date
  score: number
  reason: MemoryContextReason
  linkedFrom?: string
  depth: number
  order: number
}

type MemoryContextMeta = {
  path: string
  reason: MemoryContextReason
  linkedFrom?: string
  depth: number
}

function buildMemoryBlock(input: {
  included: { path: string; content: string; updatedAt: Date }[]
  omitted: string[]
}): string {
  const sections = input.included.map((file) => [
    `## ${file.path}`,
    `(updated ${file.updatedAt.toISOString()})`,
    "",
    file.content,
  ].join("\n"))

  const note = input.omitted.length > 0
    ? [
      "---",
      `Note: ${input.omitted.length} file(s) omitted (budget limit). Use memory_search to find specific content.`,
    ].join("\n")
    : null

  return [
    "<memexai_memory>",
    ...sections,
    note,
    "</memexai_memory>",
  ].filter(Boolean).join("\n\n")
}

export function extractWikiLinks(content: string): string[] {
  const links = new Set<string>()
  const regex = /\[\[([^\]\n]+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const path = match[1]?.trim()
    if (path) links.add(path)
  }
  return [...links]
}

function rowToMemoryContextFile(row: SmartReadRow, ctx: ToolContext, index: number, reason: MemoryContextReason): MemoryContextFile | null {
  const path = physicalToVirtual(row.physical_path, ctx)
  if (!path) return null
  return {
    path,
    content: row.content_text,
    updatedAt: row.updated_at,
    score: typeof row.rank === "number" ? Number(row.rank) : 0,
    reason,
    depth: 0,
    order: index,
  }
}

async function fetchVisibleFilesByVirtualPath(db: Db, paths: string[], ctx: ToolContext): Promise<MemoryContextFile[]> {
  const physicalPaths = paths.flatMap((path) => {
    try {
      return [virtualToPhysical(path, ctx)]
    } catch {
      return []
    }
  })
  if (physicalPaths.length === 0) return []

  const { rows } = await db.query<SmartReadRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = ANY($1)`,
    [physicalPaths],
  )

  return rows.flatMap((row, index) => {
    const file = rowToMemoryContextFile(row, ctx, index, "linked")
    return file ? [file] : []
  })
}

export async function resolveVisibleLinkedPaths(db: Db, paths: string[], ctx: ToolContext): Promise<MemoryContextFile[]> {
  return fetchVisibleFilesByVirtualPath(db, paths, ctx)
}

function rankMemoryContextFiles(files: MemoryContextFile[]): MemoryContextFile[] {
  return [...files].sort((a, b) => {
    const reasonDelta = reasonPriority(a.reason) - reasonPriority(b.reason)
    if (reasonDelta !== 0) return reasonDelta
    if (b.score !== a.score) return b.score - a.score
    const recencyDelta = b.updatedAt.getTime() - a.updatedAt.getTime()
    if (recencyDelta !== 0) return recencyDelta
    return a.order - b.order
  })
}

function reasonPriority(reason: MemoryContextReason): number {
  return reason === "linked" ? 1 : 0
}

async function fetchSmartReadSeeds(db: Db, input: { query?: string }, ctx: ToolContext): Promise<MemoryContextFile[]> {
  const values: unknown[] = [`users/${ctx.userId}/%`]
  let sql = `
    SELECT id, physical_path, content_text, created_at, updated_at
    FROM mx_file
    WHERE physical_path LIKE $1 OR physical_path LIKE 'shared/%'
    ORDER BY updated_at DESC
  `

  if (input.query) {
    values.unshift(input.query)
    sql = `
      WITH q AS (SELECT plainto_tsquery('english', $1) AS query)
      SELECT id, physical_path, content_text, created_at, updated_at, ts_rank_cd(search_vector, q.query) AS rank
      FROM mx_file, q
      WHERE (physical_path LIKE $2 OR physical_path LIKE 'shared/%')
        AND search_vector @@ q.query
      ORDER BY rank DESC, updated_at DESC
    `
  }

  const { rows } = await db.query<SmartReadRow>(sql, values)
  return rows.flatMap((row, index) => {
    const file = rowToMemoryContextFile(row, ctx, index, input.query ? "query_match" : "recency")
    return file ? [file] : []
  })
}

export async function retrieveMemoryContext(db: Db, ctx: ToolContext, options: {
  maxChars: number
  query?: string
  includeRelated?: boolean
  relatedDepth?: number
  linkedScoreMultiplier?: number
}) {
  const relatedDepth = options.relatedDepth ?? 1
  const includeRelated = options.includeRelated ?? Boolean(options.query)
  const linkedScoreMultiplier = options.linkedScoreMultiplier ?? 0.35
  const seeds = await fetchSmartReadSeeds(db, { query: options.query }, ctx)
  const candidatesByPath = new Map<string, MemoryContextFile>()
  const visited = new Set<string>()

  for (const seed of seeds) {
    candidatesByPath.set(seed.path, seed)
    visited.add(seed.path)
  }

  let frontier = seeds
  for (let depth = 1; includeRelated && depth <= relatedDepth && frontier.length > 0; depth += 1) {
    const linkSources = new Map<string, MemoryContextFile>()
    for (const source of frontier) {
      for (const linkedPath of extractWikiLinks(source.content)) {
        if (visited.has(linkedPath) || linkSources.has(linkedPath)) continue
        try {
          virtualToPhysical(linkedPath, ctx)
        } catch {
          continue
        }
        linkSources.set(linkedPath, source)
      }
    }

    const linkOrder = new Map([...linkSources.keys()].map((path, index) => [path, index]))
    const linkedFiles = (await resolveVisibleLinkedPaths(db, [...linkSources.keys()], ctx))
      .sort((a, b) => (linkOrder.get(a.path) ?? 0) - (linkOrder.get(b.path) ?? 0))
    frontier = []
    for (const linkedFile of linkedFiles) {
      if (visited.has(linkedFile.path)) continue
      const source = linkSources.get(linkedFile.path)
      if (!source) continue
      const candidate = {
        ...linkedFile,
        reason: "linked" as const,
        linkedFrom: source.path,
        depth,
        score: source.score * linkedScoreMultiplier,
        order: seeds.length + candidatesByPath.size,
      }
      candidatesByPath.set(candidate.path, candidate)
      visited.add(candidate.path)
      frontier.push(candidate)
    }
  }

  const included: MemoryContextFile[] = []
  const omitted: string[] = []
  let usedChars = 0

  for (const file of rankMemoryContextFiles([...candidatesByPath.values()])) {
    const sectionChars = file.path.length + file.content.length + 64
    if (usedChars + sectionChars <= options.maxChars || included.length === 0) {
      if (sectionChars <= options.maxChars || included.length === 0) {
        included.push(file)
        usedChars += sectionChars
        continue
      }
    }
    omitted.push(file.path)
  }

  return {
    included,
    omitted,
    filesIncludedMeta: included.map((file): MemoryContextMeta => ({
      path: file.path,
      reason: file.reason,
      linkedFrom: file.linkedFrom,
      depth: file.depth,
    })),
  }
}

export async function executeMemorySmartRead(db: Db, args: unknown, ctx: ToolContext) {
  const { maxChars = 24_000, query, includeRelated, relatedDepth = 1 } = smartReadArgsSchema.parse(args ?? {})
  const context = await retrieveMemoryContext(db, ctx, { maxChars, query, includeRelated, relatedDepth })

  await logAccess(db, { physicalPath: "*", operation: "smart_read", ctx })

  return {
    content: buildMemoryBlock({ included: context.included, omitted: context.omitted }),
    filesIncluded: context.included.map((file) => file.path),
    filesOmitted: context.omitted,
    filesIncludedMeta: context.filesIncludedMeta,
    truncated: context.omitted.length > 0,
  }
}

type SearchRow = {
  physical_path: string
  snippet: string
  rank: number
  updated_at: Date
}

export async function executeMemorySearch(db: Db, args: unknown, ctx: ToolContext, options: { model?: unknown } = {}) {
  const parsed = searchArgsSchema.parse(args)
  const { query, limit = 10, prefix } = parsed
  if (options.model) {
    return executeAgenticMemorySearch(db, parsed, ctx, options.model)
  }
  return executeMemorySearchBm25(db, { query, limit, prefix }, ctx)
}

type MemorizeWrite = {
  tool: "memory_write" | "memory_patch"
  path: string
  reason?: string
  args: unknown
  result?: unknown
}

type MemoryLlmPassResult = {
  text: string
  dryRun: boolean
  writes: MemorizeWrite[]
}

async function runMemoryLlmPass(
  db: Db,
  ctx: ToolContext,
  options: {
    systemPrompt: string
    inputPrompt: string
    model: unknown
    maxWrites: number
    dryRun?: boolean
    budgetErrorMessage: string
  },
): Promise<MemoryLlmPassResult> {
  const dryRun = options.dryRun ?? false
  const writes: MemorizeWrite[] = []

  const ensureWriteBudget = () => {
    if (writes.length >= options.maxWrites) {
      throw new MemexError("MAX_WRITES_EXCEEDED", options.budgetErrorMessage)
    }
  }

  const result = await generateText({
    model: options.model as never,
    system: options.systemPrompt,
    prompt: options.inputPrompt,
    tools: {
      memory_write: {
        description: "Create or overwrite a writable user/** memory file.",
        inputSchema: jsonSchema({
          type: "object",
          required: ["path", "content"],
          additionalProperties: false,
          properties: {
            path: { type: "string" },
            content: { type: "string" },
            reason: { type: "string" },
          },
        }),
        execute: async (toolArgs: unknown) => {
          ensureWriteBudget()
          const parsed = writeArgsSchema.parse(toolArgs)
          assertWritableVirtualPath(parsed.path)
          const planned: MemorizeWrite = {
            tool: "memory_write",
            path: parsed.path,
            reason: parsed.reason,
            args: parsed,
          }
          if (!dryRun) planned.result = await executeMemoryWrite(db, parsed, ctx)
          writes.push(planned)
          return dryRun ? { planned: true, path: parsed.path } : planned.result
        },
      },
      memory_patch: {
        description: "Patch a writable user/** memory file.",
        inputSchema: jsonSchema({
          type: "object",
          required: ["path", "operation"],
          additionalProperties: false,
          properties: {
            path: { type: "string" },
            operation: { type: "string", enum: ["append_lines", "replace_lines"] },
            after_heading: { type: "string", description: "Optional heading for section insert; omit to append at EOF." },
            lines: { type: "array", items: { type: "string" } },
            match: { type: "string" },
            replacement: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
            reason: { type: "string" },
          },
        }),
        execute: async (toolArgs: unknown) => {
          ensureWriteBudget()
          const parsed = patchArgsSchema.parse(toolArgs)
          assertWritableVirtualPath(parsed.path)
          const planned: MemorizeWrite = {
            tool: "memory_patch",
            path: parsed.path,
            reason: parsed.reason,
            args: parsed,
          }
          if (!dryRun) planned.result = await executeMemoryPatch(db, parsed, ctx)
          writes.push(planned)
          return dryRun ? { planned: true, path: parsed.path } : planned.result
        },
      },
    },
    stopWhen: stepCountIs(Math.max(1, options.maxWrites + 1)),
  })

  return {
    text: result.text,
    dryRun,
    writes,
  }
}

export async function executeMemoryMemorize(db: Db, args: unknown, ctx: ToolContext, options: { model?: unknown } = {}) {
  const { text, maxWrites = 5, dryRun = false } = memorizeArgsSchema.parse(args)
  if (!options.model) {
    throw new MemexError("MODEL_NOT_CONFIGURED", "memory_memorize requires a configured model")
  }

  const list = await executeMemoryList(db, {}, ctx)
  const indexReads = await Promise.allSettled([
    executeMemoryRead(db, { path: "user/index.md" }, ctx),
    executeMemoryRead(db, { path: "shared/index.md" }, ctx),
  ])
  const indexes = indexReads.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])

  return runMemoryLlmPass(db, ctx, {
    model: options.model,
    maxWrites,
    dryRun,
    budgetErrorMessage: "memory_memorize write budget exceeded",
    systemPrompt: [
      "You are a memory ingestion agent.",
      "Extract only durable facts worth remembering.",
      "Use virtual paths only, such as user/profile.md.",
      "Never use physical paths such as users/{userId}/...",
      "Prefer memory_patch when a relevant user file already exists.",
      "Use memory_write only for new user files.",
      "Always include a concise reason.",
      "After writing or patching any user file, also update user/index.md: patch it if it exists, write it if not. Add or update a one-line entry per file in the format: `- user/filename.md - <short purpose>`.",
      "After all writes, append one line per written file to user/log.md (patch with append_lines and no after_heading if exists, write if not): `- [YYYY-MM-DD] <wrote|patched> user/filename.md - <reason>`. Use today's date.",
      "When writing a new file, if related files already exist, add a `## See also` section with `[[user/related.md]]` links. When patching, add links if newly relevant.",
      dryRun ? "Dry run is enabled; plan writes but do not commit them." : "Commit useful writes.",
    ].join("\n"),
    inputPrompt: [
      "Text to memorize:",
      text,
      "",
      "Existing files:",
      JSON.stringify(list.files, null, 2),
      "",
      "Index files:",
      JSON.stringify(indexes.map((file) => ({ path: file.path, content: file.content })), null, 2),
    ].join("\n"),
  })
}

type ConsolidateResult = MemoryLlmPassResult & {
  filesRead: string[]
  filesTouched: string[]
}

export async function executeMemoryConsolidate(
  db: Db,
  ctx: ToolContext,
  options: { model?: unknown; maxWrites?: number; dryRun?: boolean } = {},
): Promise<ConsolidateResult> {
  if (!options.model) {
    throw new MemexError("MODEL_NOT_CONFIGURED", "memory_consolidate requires a configured model")
  }

  const maxWrites = options.maxWrites ?? 10
  const dryRun = options.dryRun ?? false
  const list = await executeMemoryList(db, { prefix: "user" }, ctx)
  const files = list.files.filter((file) => !isDreamExcludedPath(file.path))
  if (files.length === 0) {
    return { text: "No user memory files to consolidate.", dryRun, writes: [], filesRead: [], filesTouched: [] }
  }

  const reads = await Promise.all(files.map((file) => executeMemoryRead(db, { path: file.path }, ctx)))
  const today = new Date().toISOString().slice(0, 10)
  const result = await runMemoryLlmPass(db, { ...ctx, actor: ctx.actor ?? "dream-agent" }, {
    model: options.model,
    maxWrites,
    dryRun,
    budgetErrorMessage: "memory_consolidate write budget exceeded",
    systemPrompt: [
      "You are a memory consolidation agent. Your job is to improve the quality of existing memory files, not to add new facts.",
      "Rules:",
      "- Merge duplicate facts: if the same thing is stated multiple ways, keep the clearest.",
      "- Rewrite fragmented bullet points for clarity.",
      "- Resolve direct contradictions: if two lines disagree, keep the more specific/recent-sounding one.",
      "- Do NOT delete any fact unless it directly contradicts another in the same file.",
      "- Do NOT add new facts that are not already present.",
      "- Do NOT touch user/log.md, user/dream-log.md, or any file ending in -log.md.",
      "- Prefer memory_patch over memory_write to minimize blast radius.",
      `- After consolidating, write one line to user/dream-log.md: [${today}] dream-consolidation: touched <N> files - <brief summary>`,
      dryRun ? "Dry run is enabled; plan writes but do not commit them." : "Commit useful writes.",
    ].join("\n"),
    inputPrompt: [
      "Existing user memory files to consolidate:",
      JSON.stringify(reads.map((file) => ({ path: file.path, updatedAt: file.updatedAt, content: file.content })), null, 2),
    ].join("\n"),
  })

  return {
    ...result,
    filesRead: reads.map((file) => file.path),
    filesTouched: Array.from(new Set(result.writes.map((write) => write.path))),
  }
}

async function executeMemorySearchBm25(db: Db, input: { query: string; limit?: number; prefix?: string }, ctx: ToolContext) {
  const { query, limit = 10, prefix } = input
  const values: unknown[] = [query]
  let visibilityWhere = "(physical_path LIKE $2 OR physical_path LIKE 'shared/%')"
  values.push(`users/${ctx.userId}/%`)

  if (prefix) {
    const physicalPrefix = prefixToPhysical(prefix, ctx)
    if (!physicalPrefix) throw new MemexError("INVALID_PATH", "prefix is required")
    visibilityWhere = "(physical_path = $2 OR physical_path LIKE $3)"
    values.length = 1
    values.push(physicalPrefix, `${physicalPrefix.endsWith("/") ? physicalPrefix : `${physicalPrefix}/`}%`)
  }
  values.push(limit)

  const { rows } = await db.query<SearchRow>(
    `
      WITH q AS (SELECT plainto_tsquery('english', $1) AS query)
      SELECT
        physical_path,
        ts_headline('english', content_text, q.query, 'MaxFragments=2, MinWords=4, MaxWords=24') AS snippet,
        ts_rank_cd(search_vector, q.query) AS rank,
        updated_at
      FROM mx_file, q
      WHERE ${visibilityWhere}
        AND search_vector @@ q.query
      ORDER BY rank DESC, updated_at DESC
      LIMIT $${values.length}
    `,
    values,
  )

  const logPath = prefix ? prefixToPhysical(prefix, ctx) : "*"
  await logAccess(db, { physicalPath: logPath ?? "*", operation: "search", ctx })

  return {
    query,
    results: rows.flatMap((row) => {
      const path = physicalToVirtual(row.physical_path, ctx)
      if (!path) return []
      return [{
        path,
        snippet: row.snippet,
        rank: Number(row.rank),
        updatedAt: row.updated_at,
      }]
    }),
    truncated: false,
  }
}

async function executeAgenticMemorySearch(
  db: Db,
  input: { query: string; maxChars?: number; limit?: number; maxReads?: number; prefix?: string },
  ctx: ToolContext,
  model: unknown,
) {
  const maxReads = input.maxReads ?? 5
  const maxChars = input.maxChars ?? 8_000
  const candidates = await executeMemorySearchBm25(db, { query: input.query, limit: input.limit, prefix: input.prefix }, ctx)
  const list = await executeMemoryList(db, { prefix: input.prefix }, ctx)
  const indexReads = await Promise.allSettled([
    executeMemoryRead(db, { path: "user/index.md" }, ctx),
    executeMemoryRead(db, { path: "shared/index.md" }, ctx),
  ])
  const indexes = indexReads.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])
  let reads = 0
  const sources = new Set<string>()

  const result = await generateText({
    model: model as never,
    system: [
      "You are a read-only memory resolver.",
      "Answer the user's query using only MemexAI memory.",
      "Use virtual paths only, such as user/profile.md or shared/index.md.",
      "Never use physical paths such as users/{userId}/...",
      "Do not write, patch, memorize, or mutate memory.",
      "Cite relevant memory paths in your answer.",
      `Stay under ${maxChars} characters.`,
    ].join("\n"),
    prompt: [
      `Query: ${input.query}`,
      "",
      "Visible files:",
      JSON.stringify(list.files, null, 2),
      "",
      "BM25 candidates:",
      JSON.stringify(candidates.results, null, 2),
      "",
      "Index files:",
      JSON.stringify(indexes.map((file) => ({ path: file.path, content: file.content })), null, 2),
    ].join("\n"),
    tools: {
      memory_read: {
        description: "Read a memory file by virtual path. Read-only.",
        inputSchema: jsonSchema({
          type: "object",
          required: ["path"],
          additionalProperties: false,
          properties: { path: { type: "string" } },
        }),
        execute: async (args: unknown) => {
          if (reads >= maxReads) throw new MemexError("MAX_READS_EXCEEDED", "memory_search read budget exceeded")
          reads += 1
          const parsed = readArgsSchema.parse(args)
          const file = await executeMemoryRead(db, parsed, ctx)
          sources.add(file.path)
          return file
        },
      },
      memory_smart_read: {
        description: "Read a bounded context block by query. Read-only.",
        inputSchema: jsonSchema({
          type: "object",
          additionalProperties: false,
          properties: {
            maxChars: { type: "number" },
            query: { type: "string" },
            includeRelated: { type: "boolean" },
            relatedDepth: { type: "number" },
          },
        }),
        execute: async (args: unknown) => {
          if (reads >= maxReads) throw new MemexError("MAX_READS_EXCEEDED", "memory_search read budget exceeded")
          reads += 1
          const block = await executeMemorySmartRead(db, args, ctx)
          for (const path of block.filesIncluded) sources.add(path)
          return block
        },
      },
    },
    stopWhen: stepCountIs(Math.max(1, maxReads + 1)),
  })

  return {
    ...candidates,
    answer: result.text.slice(0, maxChars),
    sources: Array.from(sources),
  }
}

export async function executeTool(db: Db, toolName: string, args: unknown, ctx: ToolContext, options: { model?: unknown } = {}) {
  switch (toolName as ToolName) {
    case "memory_list":
      return executeMemoryList(db, args, ctx)
    case "memory_read":
      return executeMemoryRead(db, args, ctx)
    case "memory_write":
      return executeMemoryWrite(db, args, ctx)
    case "memory_patch":
      return executeMemoryPatch(db, args, ctx)
    case "memory_smart_read":
      return executeMemorySmartRead(db, args, ctx)
    case "memory_search":
      return executeMemorySearch(db, args, ctx, options)
    case "memory_memorize":
      return executeMemoryMemorize(db, args, ctx, options)
    default:
      throw new MemexError("UNKNOWN_TOOL", `Unknown tool: ${toolName}`)
  }
}
