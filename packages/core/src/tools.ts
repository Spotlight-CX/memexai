import type { Db } from "./db"
import { MemexError } from "./errors"
import { newId } from "./ids"
import { assertWritableVirtualPath, physicalToVirtual, prefixToPhysical, resolveMemoryPermissions, virtualToPhysical, type MemoryPermissions, type SharedWriteMode, type ToolContext } from "./paths"
import { appendLinesAfterHeading, replaceExactText } from "./text-patch"
import { contextArgsSchema, findArgsSchema, listArgsSchema, patchArgsSchema, readArgsSchema, rememberArgsSchema, writeArgsSchema } from "./schemas"
import { type ToolName } from "./tool-definitions"
import { generateText, jsonSchema, stepCountIs } from "ai"
import { isDreamExcludedPath } from "./dream-paths"
import {
  contextWithTrace,
  usageFromGenerateTextResult,
  withObservationSpan,
  withRootObservation,
  type ObservationSearchStats,
  type ObservationUsage,
} from "./observability"
import {
  SearchError,
  bm25Search,
  hybridSearch,
  prepareFileEmbedding,
  storePreparedEmbedding,
  type EmbeddingConfig,
  type SearchMatchReason,
  type SearchScope,
} from "@memexai/search"

type FileRow = {
  id: string
  physical_path: string
  content_text: string
  created_at: Date
  updated_at: Date
}

type ExecuteToolOptions = EmbeddingConfig & {
  model?: unknown
  sharedWriteMode?: SharedWriteMode
  permissions?: MemoryPermissions
  rrfK?: number
  bm25CandidateLimit?: number
  vectorCandidateLimit?: number
  observeRoot?: boolean
}

type MemorySearchResult = {
  query: string
  results: {
    path: string
    snippet?: string
    rank: number
    matchReason?: "lexical" | "semantic" | "hybrid"
    bm25Rank?: number
    vectorRank?: number
    bm25Score?: number
    vectorDistance?: number
    updatedAt?: Date
  }[]
  truncated: boolean
  answer?: string
  sources?: string[]
  usage?: ObservationUsage
  searchStats?: ObservationSearchStats
}

function modelName(model: unknown): string | null {
  if (!model || typeof model !== "object") return null
  const value = model as Record<string, unknown>
  const id = value.modelId ?? value.model ?? value.id
  return typeof id === "string" ? id : null
}

function searchScope(ctx: ToolContext, prefix?: string): SearchScope {
  if (!prefix) {
    return {
      defaultUserLike: `users/${ctx.userId}/%`,
      physicalToVirtual: (physicalPath) => physicalToVirtual(physicalPath, ctx),
    }
  }

  const physicalPrefix = prefixToPhysical(prefix, ctx)
  if (!physicalPrefix) throw new MemexError("INVALID_PATH", "prefix is required")
  return {
    defaultUserLike: `users/${ctx.userId}/%`,
    prefixExact: physicalPrefix,
    prefixLike: `${physicalPrefix.endsWith("/") ? physicalPrefix : `${physicalPrefix}/`}%`,
    physicalToVirtual: (physicalPath) => physicalToVirtual(physicalPath, ctx),
  }
}

async function prepareCoreFileEmbedding(db: Db, content: string, options: EmbeddingConfig) {
  if (!options.adapter) return prepareFileEmbedding(content, options)
  return withObservationSpan(db, { name: "embedding", operation: "embedding" }, async () => {
    try {
      return await prepareFileEmbedding(content, options)
    } catch (error) {
      if (error instanceof SearchError) {
        throw new MemexError(error.code, error.message)
      }
      throw error
    }
  })
}

async function logAccess(db: Db, input: {
  fileId?: string | null
  physicalPath: string
  operation: "list" | "read" | "write" | "patch" | "context" | "find" | "remember"
  ctx: ToolContext
}) {
  await withObservationSpan(db, {
    name: "access_log_write",
    operation: input.operation,
    physicalPath: input.physicalPath,
  }, () => db.query(
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
  ))
}

async function insertRevision(db: Db, input: {
  fileId: string
  physicalPath: string
  operation: "write" | "patch"
  content: string
  reason?: string
  ctx: ToolContext
}) {
  await withObservationSpan(db, {
    name: "revision_write",
    operation: input.operation,
    physicalPath: input.physicalPath,
    attributes: { write_count: 1 },
  }, () => db.query(
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
  ))
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

  const { rows } = await withObservationSpan(db, { name: "db_read", operation: "list", physicalPath: physicalPrefix ?? "*" }, () => db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE ${where}
     ORDER BY physical_path ASC`,
    values,
  ))

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
  const { rows } = await withObservationSpan(db, { name: "db_read", operation: "read", physicalPath }, () => db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = $1`,
    [physicalPath],
  ))

  const file = rows[0]
  if (!file) throw new MemexError("FILE_NOT_FOUND", `File not found: ${path}`)

  await logAccess(db, { fileId: file.id, physicalPath, operation: "read", ctx })

  return {
    path,
    content: file.content_text,
    updatedAt: file.updated_at,
  }
}

export async function executeMemoryWrite(db: Db, args: unknown, ctx: ToolContext, options: EmbeddingConfig & { permissions?: MemoryPermissions; sharedWriteMode?: SharedWriteMode } = {}) {
  const { path, content, reason } = writeArgsSchema.parse(args)
  const permissions = options.permissions ?? resolveMemoryPermissions({ sharedWriteMode: options.sharedWriteMode })
  assertWritableVirtualPath(path, permissions)
  const physicalPath = virtualToPhysical(path, ctx)
  const preparedEmbedding = await prepareCoreFileEmbedding(db, content, options)

  const { rows } = await withObservationSpan(db, { name: "db_write", operation: "write", physicalPath }, () => db.query<{ id: string; created: boolean }>(
    `INSERT INTO mx_file (id, physical_path, content_text)
     VALUES ($1, $2, $3)
     ON CONFLICT (physical_path)
     DO UPDATE SET content_text = EXCLUDED.content_text, updated_at = now()
     RETURNING id, (xmax = 0) AS created`,
    [newId("file"), physicalPath, content],
  ))

  const file = rows[0]
  await withObservationSpan(db, { name: "db_write", operation: "embedding", physicalPath }, () => storePreparedEmbedding(db, file.id, preparedEmbedding))
  await insertRevision(db, { fileId: file.id, physicalPath, operation: "write", content, reason, ctx })
  await logAccess(db, { fileId: file.id, physicalPath, operation: "write", ctx })

  return {
    path,
    created: file.created,
    updated: !file.created,
  }
}

export async function executeMemoryPatch(db: Db, args: unknown, ctx: ToolContext, options: EmbeddingConfig & { permissions?: MemoryPermissions; sharedWriteMode?: SharedWriteMode } = {}) {
  const parsed = patchArgsSchema.parse(args)
  const permissions = options.permissions ?? resolveMemoryPermissions({ sharedWriteMode: options.sharedWriteMode })
  assertWritableVirtualPath(parsed.path, permissions)
  const physicalPath = virtualToPhysical(parsed.path, ctx)

  const { rows } = await withObservationSpan(db, { name: "db_read", operation: "patch", physicalPath }, () => db.query<FileRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = $1`,
    [physicalPath],
  ))
  const file = rows[0]
  if (!file) throw new MemexError("FILE_NOT_FOUND", `File not found: ${parsed.path}`)

  const result = parsed.operation === "append_lines"
    ? appendLinesAfterHeading(file.content_text, parsed.after_heading, parsed.lines)
    : replaceExactText(file.content_text, parsed.match, parsed.replacement)

  if (result.changed) {
    const preparedEmbedding = await prepareCoreFileEmbedding(db, result.content, options)
    await withObservationSpan(db, { name: "db_write", operation: "patch", physicalPath }, () => db.query("UPDATE mx_file SET content_text = $1, updated_at = now() WHERE id = $2", [result.content, file.id]))
    await withObservationSpan(db, { name: "db_write", operation: "embedding", physicalPath }, () => storePreparedEmbedding(db, file.id, preparedEmbedding))
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
  matchReason?: SearchMatchReason
  bm25Rank?: number
  vectorRank?: number
  linkedFrom?: string
  depth: number
  order: number
}

type MemoryContextMeta = {
  path: string
  reason: MemoryContextReason
  matchReason?: SearchMatchReason
  bm25Rank?: number
  vectorRank?: number
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
      `Note: ${input.omitted.length} file(s) omitted (budget limit). Use memory_find to find specific content.`,
    ].join("\n")
    : null

  return [
    "<memexai_memory>",
    ...sections,
    note,
    "</memexai_memory>",
  ].filter(Boolean).join("\n\n")
}

export function extractMemoryLinks(content: string): string[] {
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

  const { rows } = await withObservationSpan(db, { name: "db_read", operation: "read" }, () => db.query<SmartReadRow>(
    `SELECT id, physical_path, content_text, created_at, updated_at
     FROM mx_file
     WHERE physical_path = ANY($1)`,
    [physicalPaths],
  ))

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

  const { rows } = await withObservationSpan(db, { name: "db_read", operation: input.query ? "search" : "list" }, () => db.query<SmartReadRow>(sql, values))
  return rows.flatMap((row, index) => {
    const file = rowToMemoryContextFile(row, ctx, index, input.query ? "query_match" : "recency")
    return file ? [file] : []
  })
}

async function fetchSmartReadHybridSeeds(db: Db, input: {
  query: string
  adapter: NonNullable<EmbeddingConfig["adapter"]>
  rrfK?: number
  bm25CandidateLimit?: number
  vectorCandidateLimit?: number
}, ctx: ToolContext): Promise<MemoryContextFile[]> {
  const preparedQueryEmbedding = await prepareCoreFileEmbedding(db, input.query, {
    adapter: input.adapter,
    maxChars: Number.MAX_SAFE_INTEGER,
  })
  const queryEmbedding = preparedQueryEmbedding?.status === "ready" ? preparedQueryEmbedding.vector : undefined

  const ranked = await withObservationSpan(db, {
    name: "hybrid_search",
    operation: "smart_read",
    attributes: {
      search_mode: "hybrid",
      query_embedding: Boolean(queryEmbedding),
      bm25_candidate_limit: input.bm25CandidateLimit ?? null,
      vector_candidate_limit: input.vectorCandidateLimit ?? null,
      rrf_k: input.rrfK ?? null,
    },
  }, () => hybridSearch(db, {
    query: input.query,
    queryEmbedding,
    rrfK: input.rrfK,
    bm25CandidateLimit: input.bm25CandidateLimit,
    vectorCandidateLimit: input.vectorCandidateLimit,
    dimensions: input.adapter.dimensions,
    scope: searchScope(ctx),
  }))

  const rankedByPath = new Map(ranked.map((result, index) => [result.path, { result, index }]))
  const files = await fetchVisibleFilesByVirtualPath(db, ranked.map((result) => result.path), ctx)
  return files
    .flatMap((file) => {
      const rankedFile = rankedByPath.get(file.path)
      if (!rankedFile) return []
      return [{
        ...file,
        score: rankedFile.result.score,
        reason: "query_match" as const,
        matchReason: rankedFile.result.matchReason,
        bm25Rank: rankedFile.result.bm25Rank,
        vectorRank: rankedFile.result.vectorRank,
        depth: 0,
        order: rankedFile.index,
      }]
    })
    .sort((a, b) => a.order - b.order)
}

export async function retrieveMemoryContext(db: Db, ctx: ToolContext, options: {
  maxChars: number
  query?: string
  includeRelated?: boolean
  relatedDepth?: number
  linkedScoreMultiplier?: number
} & Pick<ExecuteToolOptions, "adapter" | "rrfK" | "bm25CandidateLimit" | "vectorCandidateLimit">) {
  const relatedDepth = options.relatedDepth ?? 1
  const includeRelated = options.includeRelated ?? Boolean(options.query)
  const linkedScoreMultiplier = options.linkedScoreMultiplier ?? 0.35
  const seeds = options.query && options.adapter
    ? await fetchSmartReadHybridSeeds(db, {
      query: options.query,
      adapter: options.adapter,
      rrfK: options.rrfK,
      bm25CandidateLimit: options.bm25CandidateLimit,
      vectorCandidateLimit: options.vectorCandidateLimit,
    }, ctx)
    : await fetchSmartReadSeeds(db, { query: options.query }, ctx)
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
      for (const linkedPath of extractMemoryLinks(source.content)) {
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
      matchReason: file.matchReason,
      bm25Rank: file.bm25Rank,
      vectorRank: file.vectorRank,
      linkedFrom: file.linkedFrom,
      depth: file.depth,
    })),
  }
}

export async function executeMemoryContext(db: Db, args: unknown, ctx: ToolContext, options: ExecuteToolOptions = {}) {
  const { maxChars = 24_000, query, includeRelated, relatedDepth = 1 } = contextArgsSchema.parse(args ?? {})
  const context = await retrieveMemoryContext(db, ctx, {
    maxChars,
    query,
    includeRelated,
    relatedDepth,
    adapter: options.adapter,
    rrfK: options.rrfK,
    bm25CandidateLimit: options.bm25CandidateLimit,
    vectorCandidateLimit: options.vectorCandidateLimit,
  })

  await logAccess(db, { physicalPath: "*", operation: "context", ctx })

  return {
    content: buildMemoryBlock({ included: context.included, omitted: context.omitted }),
    filesIncluded: context.included.map((file) => file.path),
    filesOmitted: context.omitted,
    filesIncludedMeta: context.filesIncludedMeta,
    truncated: context.omitted.length > 0,
  }
}

export async function executeMemoryFind(db: Db, args: unknown, ctx: ToolContext, options: ExecuteToolOptions = {}): Promise<MemorySearchResult> {
  const parsed = findArgsSchema.parse(args)
  const { query, limit = 10, prefix } = parsed
  if (options.adapter) {
    const adapter = options.adapter
    const preparedQueryEmbedding = await prepareCoreFileEmbedding(db, query, { adapter, maxChars: Number.MAX_SAFE_INTEGER })
    const queryEmbedding = preparedQueryEmbedding?.status === "ready" ? preparedQueryEmbedding.vector : undefined
    const results = await withObservationSpan(db, {
      name: "hybrid_search",
      operation: "search",
      attributes: {
        search_mode: "hybrid",
        query_embedding: Boolean(queryEmbedding),
        bm25_candidate_limit: options.bm25CandidateLimit ?? null,
        vector_candidate_limit: options.vectorCandidateLimit ?? null,
        rrf_k: options.rrfK ?? null,
      },
    }, () => hybridSearch(db, {
      query,
      queryEmbedding,
      limit,
      rrfK: options.rrfK,
      bm25CandidateLimit: options.bm25CandidateLimit,
      vectorCandidateLimit: options.vectorCandidateLimit,
      dimensions: adapter.dimensions,
      scope: searchScope(ctx, prefix),
    }))

    const logPath = prefix ? prefixToPhysical(prefix, ctx) : "*"
    await logAccess(db, { physicalPath: logPath ?? "*", operation: "find", ctx })

    return {
      query,
      results: results.map((result) => ({
        path: result.path,
        snippet: result.snippet ?? result.content?.slice(0, 240) ?? "",
        rank: result.score,
        matchReason: result.matchReason,
        bm25Rank: result.bm25Rank,
        vectorRank: result.vectorRank,
        bm25Score: result.bm25Score,
        vectorDistance: result.vectorDistance,
        updatedAt: result.updatedAt,
      })),
      truncated: false,
      searchStats: {
        searchMode: "hybrid",
        candidateCount: results.length,
        filesReturned: results.length,
      },
    }
  }
  return executeMemoryFindBm25(db, { query, limit, prefix }, ctx)
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
  usage?: ObservationUsage
}

async function runMemoryLlmPass(
  db: Db,
  ctx: ToolContext,
  options: {
    systemPrompt: string
    inputPrompt: string
    model: unknown
    maxWrites: number
    maxReads?: number
    dryRun?: boolean
    budgetErrorMessage: string
  } & EmbeddingConfig & { permissions?: MemoryPermissions; sharedWriteMode?: SharedWriteMode },
): Promise<MemoryLlmPassResult> {
  const dryRun = options.dryRun ?? false
  const maxReads = options.maxReads ?? 0
  const permissions = options.permissions ?? resolveMemoryPermissions({ sharedWriteMode: options.sharedWriteMode })
  const writablePaths = permissions.writableMounts.includes("shared") ? "user/** and shared/**" : "user/**"
  const sharedGuardrail = permissions.writableMounts.includes("shared")
    ? " Use shared/** only for durable global knowledge, project canon, policies, style rules, workflow lessons, and cross-user insights; never store private user facts in shared/**."
    : " shared/** is read-only for agents."
  const writes: MemorizeWrite[] = []
  let reads = 0

  const ensureWriteBudget = () => {
    if (writes.length >= options.maxWrites) {
      throw new MemexError("MAX_WRITES_EXCEEDED", options.budgetErrorMessage)
    }
  }

  type LlmTool = { description: string; inputSchema: unknown; execute: (args: unknown) => Promise<unknown> }
  const tools: Record<string, LlmTool> = {}

  if (maxReads > 0) {
    tools.memory_read = {
      description: "Read a user/** or shared/** memory file by virtual path before writing.",
      inputSchema: jsonSchema({
        type: "object",
        required: ["path"],
        additionalProperties: false,
        properties: { path: { type: "string" } },
      }),
      execute: async (toolArgs: unknown) => {
        if (reads >= maxReads) {
          throw new MemexError("MAX_READS_EXCEEDED", "memory_remember read budget exceeded")
        }
        reads += 1
        const parsed = readArgsSchema.parse(toolArgs)
        return executeMemoryRead(db, parsed, ctx)
      },
    }
  }

  tools.memory_write = {
    description: `Create or overwrite a writable memory file. Writable paths: ${writablePaths}.${sharedGuardrail}`,
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
      assertWritableVirtualPath(parsed.path, permissions)
      const planned: MemorizeWrite = {
        tool: "memory_write",
        path: parsed.path,
        reason: parsed.reason,
        args: parsed,
      }
      if (!dryRun) planned.result = await executeMemoryWrite(db, parsed, ctx, options)
      writes.push(planned)
      return dryRun ? { planned: true, path: parsed.path } : planned.result
    },
  }

  tools.memory_patch = {
    description: `Patch a writable memory file. Writable paths: ${writablePaths}. Prefer this over full rewrites for shared files.${sharedGuardrail}`,
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
      assertWritableVirtualPath(parsed.path, permissions)
      const planned: MemorizeWrite = {
        tool: "memory_patch",
        path: parsed.path,
        reason: parsed.reason,
        args: parsed,
      }
      if (!dryRun) planned.result = await executeMemoryPatch(db, parsed, ctx, options)
      writes.push(planned)
      return dryRun ? { planned: true, path: parsed.path } : planned.result
    },
  }

  const result = await withObservationSpan(db, {
    name: "llm_generate",
    operation: "memorize",
    attributes: { model: modelName(options.model), write_count: writes.length },
  }, () => generateText({
    model: options.model as never,
    system: options.systemPrompt,
    prompt: options.inputPrompt,
    tools: tools as any,
    stopWhen: stepCountIs(Math.max(1, options.maxWrites + maxReads + 1)),
  }))

  return {
    text: result.text,
    dryRun,
    writes,
    usage: usageFromGenerateTextResult(result),
  }
}

function logTail(content: string, maxLines = 15): string {
  const lines = content.split(/\r?\n/)
  return lines.slice(-maxLines).join("\n")
}

export async function executeMemoryRemember(db: Db, args: unknown, ctx: ToolContext, options: ExecuteToolOptions = {}) {
  const { text, maxWrites = 5, dryRun = false } = rememberArgsSchema.parse(args)
  const maxReads = 3
  if (!options.model) {
    throw new MemexError("MODEL_NOT_CONFIGURED", "memory_remember requires a configured model")
  }
  const permissions = options.permissions ?? resolveMemoryPermissions({ sharedWriteMode: options.sharedWriteMode })
  const sharedWritable = permissions.writableMounts.includes("shared")

  const list = await executeMemoryList(db, {}, ctx)
  const regularFiles = list.files.filter((f) => !isDreamExcludedPath(f.path))
  const logFiles = list.files.filter((f) => isDreamExcludedPath(f.path))

  const preflight = await Promise.allSettled([
    executeMemoryRead(db, { path: "user/index.md" }, ctx),
    executeMemoryRead(db, { path: "shared/index.md" }, ctx),
    ...logFiles.map((f) => executeMemoryRead(db, { path: f.path }, ctx)),
  ])
  const [indexResult0, indexResult1, ...logResults] = preflight
  const indexes = [indexResult0, indexResult1].flatMap((r) => r?.status === "fulfilled" ? [r.value] : [])
  const logPreviews = logFiles.map((f, i) => {
    const result = logResults[i]
    const content = result?.status === "fulfilled" ? result.value.content : ""
    return `### ${f.path}\n${logTail(content)}`
  })

  return runMemoryLlmPass(db, ctx, {
    adapter: options.adapter,
    maxChars: options.maxChars,
    chunkChars: options.chunkChars,
    chunkOverlap: options.chunkOverlap,
    permissions,
    model: options.model,
    maxWrites,
    maxReads,
    dryRun,
    budgetErrorMessage: "memory_remember write budget exceeded",
    systemPrompt: [
      "You are a memory ingestion agent.",
      "Extract only durable facts worth remembering.",
      sharedWritable
        ? "Use virtual paths only. user/** is for the current user's private memory; shared/** is for durable global knowledge, project canon, policies, style rules, workflow lessons, and cross-user insights."
        : "Use virtual paths only, such as user/profile.md. shared/** is read-only for agents.",
      sharedWritable
        ? "Never store private user facts, secrets, or raw conversation dumps in shared/**. Prefer memory_patch over memory_write for shared files."
        : "Do not write to shared/**.",
      "Never use physical paths such as users/{userId}/...",
      "Before calling memory_patch on an existing file, read it first with memory_read.",
      "Use append_lines to add new facts. Use replace_lines only after reading to confirm the exact text to match.",
      sharedWritable ? "Use memory_write only for new files." : "Use memory_write only for new user files.",
      "Always include a concise reason.",
      "After writing or patching any user file, also update user/index.md: patch it if it exists, write it if not. Add or update a one-line entry per file in the format: `- user/filename.md - <short purpose>`.",
      "After all writes, append one line per written file to user/log.md (patch with append_lines and no after_heading if exists, write if not): `- [YYYY-MM-DD] <wrote|patched> user/filename.md - <reason>`. Use today's date.",
      "Log file previews are truncated. Call memory_read on a log file only if you need full history.",
      "When writing a new file, if related files already exist, add a `## See also` section with `[[user/related.md]]` links. When patching, add links if newly relevant.",
      dryRun ? "Dry run is enabled; plan writes but do not commit them." : "Commit useful writes.",
    ].join("\n"),
    inputPrompt: [
      "Text to memorize:",
      text,
      "",
      "Existing files:",
      JSON.stringify(regularFiles.map((f) => ({ path: f.path, size: f.size })), null, 2),
      "",
      ...(logPreviews.length > 0
        ? ["Log file previews (last 15 lines — call memory_read for full history if needed):", ...logPreviews, ""]
        : []),
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
  options: ExecuteToolOptions & { maxWrites?: number; maxFiles?: number; maxInputChars?: number; dryRun?: boolean } = {},
): Promise<ConsolidateResult> {
  if (options.observeRoot !== false) {
    return withRootObservation(db, {
      ctx,
      toolName: "memory_consolidate",
      operation: "dream_run",
      attributes: { model: modelName(options.model) },
    }, (observedCtx) => executeMemoryConsolidate(db, observedCtx, { ...options, observeRoot: false })) as Promise<ConsolidateResult>
  }

  ctx = contextWithTrace(ctx)
  if (!options.model) {
    throw new MemexError("MODEL_NOT_CONFIGURED", "memory_consolidate requires a configured model")
  }

  const maxWrites = options.maxWrites ?? 10
  const maxFiles = options.maxFiles ?? 20
  const maxInputChars = options.maxInputChars ?? 120_000
  const dryRun = options.dryRun ?? false
  const list = await executeMemoryList(db, { prefix: "user" }, ctx)
  const files = list.files
    .filter((file) => !isDreamExcludedPath(file.path))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, maxFiles)
  if (files.length === 0) {
    return { text: "No user memory files to consolidate.", dryRun, writes: [], filesRead: [], filesTouched: [] }
  }

  const allReads = await Promise.all(files.map((file) => executeMemoryRead(db, { path: file.path }, ctx)))
  let chars = 0
  const reads = allReads.filter((r) => {
    chars += r.content.length
    return chars <= maxInputChars
  })
  const today = new Date().toISOString().slice(0, 10)
  const result = await runMemoryLlmPass(db, { ...ctx, actor: ctx.actor ?? "dream-agent" }, {
    adapter: options.adapter,
    maxChars: options.maxChars,
    chunkChars: options.chunkChars,
    chunkOverlap: options.chunkOverlap,
    permissions: options.permissions ?? resolveMemoryPermissions({ sharedWriteMode: options.sharedWriteMode }),
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
      "- If you made changes: write one line to user/dream-log.md: [" + today + "] dream-consolidation: touched <N> files - <brief summary>",
      "- If you made no changes: do NOT write to user/dream-log.md or any log file.",
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


async function executeMemoryFindBm25(db: Db, input: { query: string; limit?: number; prefix?: string }, ctx: ToolContext): Promise<MemorySearchResult> {
  const { query, limit = 10, prefix } = input
  const results = await withObservationSpan(db, {
    name: "bm25_search",
    operation: "find",
    attributes: { search_mode: "bm25", candidate_count: limit },
  }, () => bm25Search(db, { query, limit, scope: searchScope(ctx, prefix) }))

  const logPath = prefix ? prefixToPhysical(prefix, ctx) : "*"
  await logAccess(db, { physicalPath: logPath ?? "*", operation: "find", ctx })

  return {
    query,
    results: results.map((result) => ({
      path: result.path,
      snippet: result.snippet,
      rank: result.bm25Score ?? result.score,
      matchReason: "lexical" as const,
      bm25Rank: result.bm25Rank,
      bm25Score: result.bm25Score,
      updatedAt: result.updatedAt,
    })),
    truncated: false,
    searchStats: {
      searchMode: "bm25",
      candidateCount: results.length,
      filesReturned: results.length,
    },
  }
}

export async function executeTool(db: Db, toolName: string, args: unknown, ctx: ToolContext, options: ExecuteToolOptions = {}): Promise<unknown> {
  if (options.observeRoot !== false) {
    return withRootObservation(db, {
      ctx,
      toolName,
      operation: toolOperation(toolName),
      attributes: {
        search_mode: toolName === "memory_find" || toolName === "memory_context"
          ? (options.adapter ? "hybrid" : "bm25")
          : null,
        model: modelName(options.model),
      },
    }, (observedCtx) => executeTool(db, toolName, args, observedCtx, { ...options, observeRoot: false }))
  }

  ctx = contextWithTrace(ctx)
  const permissions = options.permissions ?? resolveMemoryPermissions({ sharedWriteMode: options.sharedWriteMode })
  const toolOptions = { ...options, permissions }
  switch (toolName as ToolName) {
    case "memory_list":
      return executeMemoryList(db, args, ctx)
    case "memory_read":
      return executeMemoryRead(db, args, ctx)
    case "memory_write":
      return executeMemoryWrite(db, args, ctx, toolOptions)
    case "memory_patch":
      return executeMemoryPatch(db, args, ctx, toolOptions)
    case "memory_context":
      return executeMemoryContext(db, args, ctx, toolOptions)
    case "memory_find":
      return executeMemoryFind(db, args, ctx, toolOptions)
    case "memory_remember":
      return executeMemoryRemember(db, args, ctx, toolOptions)
    default:
      throw new MemexError("UNKNOWN_TOOL", `Unknown tool: ${toolName}`)
  }
}

function toolOperation(toolName: string): string | null {
  if (toolName === "memory_list") return "list"
  if (toolName === "memory_read") return "read"
  if (toolName === "memory_write") return "write"
  if (toolName === "memory_patch") return "patch"
  if (toolName === "memory_context") return "context"
  if (toolName === "memory_find") return "find"
  if (toolName === "memory_remember") return "remember"
  return null
}
