#!/usr/bin/env node
/**
 * Docker service smoke eval for MemexAI.
 *
 * Usage:
 *   node apps/benchmark/src/docker-smoke-eval.mjs --limit 1 --max-sessions 10 --batch-size 1
 *
 * This talks to the running MemexAI HTTP service, not direct Postgres.
 *
 * Resume after rate-limit pause:
 *   node apps/benchmark/src/docker-smoke-eval.mjs --run-id <same-id> [same other flags]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, "../../..")

const argv = process.argv.slice(2)

loadDotEnv(join(repoRoot, ".env"))

function arg(flag) {
  const i = argv.indexOf(flag)
  return i !== -1 ? argv[i + 1] : undefined
}

function hasFlag(flag) {
  return argv.includes(flag)
}

function intArg(flag, fallback) {
  const value = arg(flag)
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer`)
  }
  return parsed
}

function loadDotEnv(path) {
  if (!existsSync(path)) return

  const lines = readFileSync(path, "utf-8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eq = trimmed.indexOf("=")
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

const MEMEX_URL = (
  arg("--url")
  ?? process.env.MEMEX_URL
  ?? `http://localhost:${process.env.MEMEX_PORT || 8080}`
).replace(/\/+$/, "")
const MEMEX_API_KEY = arg("--api-key") ?? process.env.MEMEX_API_KEY ?? "dev-agent-key"
const DATASET = arg("--dataset") ?? join(repoRoot, "apps/benchmark/data/longmemeval_s_cleaned.json")
const LIMIT = intArg("--limit", 10)
if (hasFlag("--max-sessions") && arg("--max-sessions") === undefined) {
  throw new Error("--max-sessions requires a value")
}
const MAX_SESSIONS = hasFlag("--max-sessions") ? intArg("--max-sessions", undefined) : undefined
if (hasFlag("--batch-size") && arg("--batch-size") === undefined) {
  throw new Error("--batch-size requires a value")
}
const BATCH_SIZE = intArg("--batch-size", 1)
const OUTPUT = arg("--output") ?? join(repoRoot, "apps/benchmark/data/docker-smoke-results.json")
const RUN_ID = arg("--run-id") ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)
const STATE_FILE = arg("--state") ?? join(repoRoot, `apps/benchmark/data/docker-smoke-state-${RUN_ID}.json`)
const SKIP_INGEST = hasFlag("--skip-ingest")
const DRY_RUN = hasFlag("--dry-run")

if (SKIP_INGEST && !arg("--run-id")) {
  throw new Error("--skip-ingest requires --run-id so the script can reuse a previous smoke run")
}

const DATASET_URLS = {
  "longmemeval_s_cleaned.json":
    "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json",
  "longmemeval_m_cleaned.json":
    "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_m_cleaned.json",
  "longmemeval_oracle.json":
    "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_oracle.json",
}

// ── State (persisted to STATE_FILE for resume) ────────────────────────────────

let runState = {
  run_id: RUN_ID,
  started_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  paused: false,
  pause_reason: null,
  completed_items: {},    // question_id → full result object
  ingest_progress: {},    // question_id → number of sessions already ingested
}

function loadRunState() {
  if (!existsSync(STATE_FILE)) return false
  try {
    const loaded = JSON.parse(readFileSync(STATE_FILE, "utf-8"))
    runState = { ...runState, ...loaded, paused: false, pause_reason: null }
    return true
  } catch (e) {
    console.warn(`Could not load state file (${STATE_FILE}): ${e.message} — starting fresh`)
    return false
  }
}

function saveRunState() {
  runState.updated_at = new Date().toISOString()
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(runState, null, 2))
}

// ── Rate-limit handling ───────────────────────────────────────────────────────

let rateLimitPaused = false

const RATE_LIMIT_SIGNALS = [
  "resource_exhausted",
  "quota exceeded",
  "rate limit",
  "too many requests",
  "ratequota",
  "429",
]

function isRateLimitError(error) {
  const msg = (error?.message ?? "").toLowerCase()
  return RATE_LIMIT_SIGNALS.some((s) => msg.includes(s))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Dataset helpers ───────────────────────────────────────────────────────────

async function ensureDataset(path) {
  if (existsSync(path)) return

  const filename = path.split("/").pop()
  const url = DATASET_URLS[filename]
  if (!url) {
    throw new Error(
      `Unknown dataset: ${filename}\n` +
      "Download it manually or use one of: " +
      Object.keys(DATASET_URLS).join(", "),
    )
  }

  mkdirSync(dirname(path), { recursive: true })
  console.log(`Downloading ${filename} from HuggingFace ...`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Dataset download failed: ${response.status} ${response.statusText}`)
  }
  writeFileSync(path, await response.text())
  console.log(`Saved dataset -> ${path}`)
}

async function checkHealth() {
  try {
    const response = await fetch(`${MEMEX_URL}/health`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }
    const body = await response.json()
    if (!body?.ok) throw new Error("health response did not include ok=true")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `MemexAI service is not reachable at ${MEMEX_URL}. ` +
      `Start Docker first, then retry. Health check error: ${message}`,
    )
  }
}

// ── Tool execution ────────────────────────────────────────────────────────────

async function executeTool(name, context, args) {
  const response = await fetch(`${MEMEX_URL}/v1/tools/${encodeURIComponent(name)}/execute`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${MEMEX_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      context,
      arguments: args,
    }),
  })

  const bodyText = await response.text()
  const body = bodyText ? parseJson(bodyText) : null

  if (!response.ok) {
    const code = body?.error?.code ?? `HTTP_${response.status}`
    const message = body?.error?.message ?? response.statusText
    throw new Error(`${name} failed with ${code}: ${message}`)
  }

  return body
}

/**
 * Wraps executeTool with rate-limit retry backoff (2 attempts, doubling delay).
 * If retries are exhausted, sets the global rateLimitPaused flag.
 */
async function executeToolWithRetry(name, context, args, { retries = 2, initialBackoffMs = 20000 } = {}) {
  let backoffMs = initialBackoffMs
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await executeTool(name, context, args)
    } catch (error) {
      if (isRateLimitError(error)) {
        if (attempt < retries) {
          console.warn(`\n[rate-limit] ${name} quota hit — waiting ${backoffMs / 1000}s then retry ${attempt + 1}/${retries}`)
          await sleep(backoffMs)
          backoffMs *= 2
          continue
        }
        // Retries exhausted — signal all workers to stop
        console.warn(`\n[rate-limit] retries exhausted — pausing run, state saved to ${STATE_FILE}`)
        rateLimitPaused = true
        runState.paused = true
        runState.pause_reason = "rate_limit"
        saveRunState()
      }
      throw error
    }
  }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Service returned invalid JSON: ${text.slice(0, 200)}`)
  }
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

function score(predicted, expected) {
  const pred = normalize(predicted)
  const exp = normalize(expected)

  const em = pred.join(" ") === exp.join(" ") ? 1 : 0
  if (pred.length === 0 || exp.length === 0) return { em, f1: em }

  const counts = new Map()
  for (const token of pred) counts.set(token, (counts.get(token) ?? 0) + 1)

  let overlap = 0
  for (const token of exp) {
    const count = counts.get(token) ?? 0
    if (count > 0) {
      overlap++
      counts.set(token, count - 1)
    }
  }

  const precision = overlap / pred.length
  const recall = overlap / exp.length
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  return { em, f1 }
}

function formatSession(session, date) {
  const lines = [`[Conversation - ${date}]`]
  for (const turn of session) {
    lines.push(`${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
  }
  return lines.join("\n")
}

function userIdFor(item) {
  const safeQuestionId = String(item.question_id).replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeRunId = String(RUN_ID).replace(/[^a-zA-Z0-9_-]/g, "_")
  return `docker_smoke_${safeRunId}_${safeQuestionId}`
}

function summarize(results) {
  const byType = new Map()
  let totalEM = 0
  let totalF1 = 0
  let errors = 0

  for (const result of results) {
    totalEM += result.em
    totalF1 += result.f1
    if (result.error) errors++

    const current = byType.get(result.question_type) ?? { em: 0, f1: 0, n: 0 }
    byType.set(result.question_type, {
      em: current.em + result.em,
      f1: current.f1 + result.f1,
      n: current.n + 1,
    })
  }

  return {
    errors,
    em: results.length ? totalEM / results.length : 0,
    f1: results.length ? totalF1 / results.length : 0,
    byType,
  }
}

// ── Concurrency ───────────────────────────────────────────────────────────────

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

// ── Per-item runner ───────────────────────────────────────────────────────────

async function runItem(item, index, totalItems) {
  const qid = item.question_id

  // Already fully completed in a prior run — return cached result
  if (runState.completed_items[qid]) {
    console.log(`[${index + 1}/${totalItems} ${qid}] skip (already completed)`)
    return runState.completed_items[qid]
  }

  const context = { userId: userIdFor(item), actor: "docker-smoke-eval" }
  const prefix = `[${index + 1}/${totalItems} ${qid}]`
  const log = (message) => console.log(`${prefix} ${message}`)

  log(`start (${item.question_type})`)

  let ingestMs = 0
  let queryMs = 0
  let predicted = ""
  let sessionsIngested = runState.ingest_progress[qid] ?? 0

  try {
    if (!SKIP_INGEST) {
      const sessions = MAX_SESSIONS
        ? item.haystack_sessions.slice(0, MAX_SESSIONS)
        : item.haystack_sessions
      const totalAvailable = item.haystack_sessions.length
      const total = sessions.length
      const ingestStart = Date.now()

      // Resume from already-ingested session count
      const resumeFrom = sessionsIngested
      if (resumeFrom > 0) {
        log(`resuming ingest from session ${resumeFrom + 1}/${total} (${resumeFrom} already done)`)
      }

      for (let s = resumeFrom; s < total; s++) {
        // Honour global pause signal from another worker
        if (rateLimitPaused) {
          log(`paused at session ${s + 1}/${total} due to rate limit`)
          saveRunState()
          break
        }

        const sessionLabel = `session ${s + 1}/${total}${total < totalAvailable ? `/${totalAvailable}` : ""}`
        log(`${sessionLabel} start`)
        const sessionStart = Date.now()
        const text = formatSession(
          sessions[s],
          item.haystack_dates[s] ?? "unknown date",
        )
        const result = await executeToolWithRetry("memory_memorize", context, {
          text,
          maxWrites: 3,
          dryRun: DRY_RUN,
        })

        sessionsIngested++
        // Persist incremental progress after every session
        runState.ingest_progress[qid] = sessionsIngested
        saveRunState()

        log(`${sessionLabel} done - ${Date.now() - sessionStart}ms (${result.writes.length} writes)`)
      }

      ingestMs = Date.now() - ingestStart

      // If we were paused mid-ingest, return a partial result (no query)
      if (rateLimitPaused) {
        return {
          question_id: qid,
          question_type: item.question_type,
          user_id: context.userId,
          question: item.question,
          expected: item.answer,
          predicted: "",
          em: 0,
          f1: 0,
          sessions_ingested: sessionsIngested,
          sessions_available: item.haystack_sessions.length,
          ingest_ms: ingestMs,
          query_ms: 0,
          skipped: "paused_rate_limit",
        }
      }

      log(`ingest done - ${total} sessions, ${ingestMs}ms total`)
    }

    const queryStart = Date.now()
    log("query start")
    const searchResult = await executeToolWithRetry("memory_search", context, {
      query: item.question,
      limit: 5,
    })
    queryMs = Date.now() - queryStart

    predicted = searchResult.answer
      ?? searchResult.results.map((result) => result.snippet).join(" ")

    const { em, f1 } = score(predicted, item.answer)
    log(`query done - ${queryMs}ms EM=${em} F1=${f1.toFixed(2)}`)

    const result = {
      question_id: qid,
      question_type: item.question_type,
      user_id: context.userId,
      question: item.question,
      expected: item.answer,
      predicted,
      em,
      f1,
      sessions_ingested: sessionsIngested,
      sessions_available: item.haystack_sessions.length,
      ingest_ms: ingestMs,
      query_ms: queryMs,
    }

    // Mark item complete and clean up progress entry
    runState.completed_items[qid] = result
    delete runState.ingest_progress[qid]
    saveRunState()

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`ERROR: ${message}`)
    // Save whatever progress we made so it can be resumed
    runState.ingest_progress[qid] = sessionsIngested
    saveRunState()
    return {
      question_id: qid,
      question_type: item.question_type,
      user_id: context.userId,
      question: item.question,
      expected: item.answer,
      predicted,
      em: 0,
      f1: 0,
      sessions_ingested: sessionsIngested,
      sessions_available: item.haystack_sessions.length,
      ingest_ms: ingestMs,
      query_ms: queryMs,
      error: message,
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== MemexAI Docker Smoke Eval ===\n")

  const resumed = loadRunState()

  console.log(`Service:    ${MEMEX_URL}`)
  console.log(`Dataset:    ${DATASET}`)
  console.log(`Limit:      ${LIMIT}`)
  console.log(`Sessions:   ${MAX_SESSIONS ? `first ${MAX_SESSIONS} per item` : "all per item"}`)
  console.log(`Batch:      ${BATCH_SIZE} item${BATCH_SIZE === 1 ? "" : "s"}`)
  console.log(`Run ID:     ${RUN_ID}`)
  console.log(`State file: ${STATE_FILE}`)
  if (resumed) {
    const nDone = Object.keys(runState.completed_items).length
    const nPartial = Object.keys(runState.ingest_progress).length
    console.log(`Resumed:    ${nDone} completed, ${nPartial} partial`)
  }
  if (SKIP_INGEST) console.log("Mode:       skip-ingest")
  if (DRY_RUN) console.log("Mode:       dry-run")
  console.log()

  await checkHealth()
  await ensureDataset(DATASET)

  const items = JSON.parse(readFileSync(DATASET, "utf-8"))
  const subset = items.slice(0, LIMIT)
  const results = await mapWithConcurrency(subset, BATCH_SIZE, (item, index) => runItem(item, index, subset.length))

  // Collect completed results from this run + cached ones
  const allResults = results.filter((r) => r && !r.skipped)
  const skipped = results.filter((r) => r?.skipped).length

  const summary = summarize(allResults)

  console.log("\n=== Results ===")
  console.log(`Items:       ${allResults.length}  (${summary.errors} errors${skipped ? `, ${skipped} paused/skipped` : ""})`)
  console.log(`Exact Match: ${(summary.em * 100).toFixed(1)}%`)
  console.log(`F1:          ${(summary.f1 * 100).toFixed(1)}%`)

  console.log("\nBy type:")
  for (const [type, value] of [...summary.byType.entries()].sort()) {
    console.log(
      `  ${type.padEnd(32)} EM=${((value.em / value.n) * 100).toFixed(1)}%  ` +
      `F1=${((value.f1 / value.n) * 100).toFixed(1)}%  (n=${value.n})`,
    )
  }

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, JSON.stringify({
    meta: {
      service_url: MEMEX_URL,
      dataset: DATASET,
      run_id: RUN_ID,
      n: allResults.length,
      errors: summary.errors,
      em: summary.em,
      f1: summary.f1,
      skip_ingest: SKIP_INGEST,
      dry_run: DRY_RUN,
      max_sessions_per_item: MAX_SESSIONS ?? null,
      batch_size: BATCH_SIZE,
      timestamp: new Date().toISOString(),
      paused: runState.paused,
    },
    by_type: Object.fromEntries(
      [...summary.byType.entries()].map(([type, value]) => [
        type,
        { em: value.em / value.n, f1: value.f1 / value.n, n: value.n },
      ]),
    ),
    results: allResults,
  }, null, 2))
  console.log(`\nFull results -> ${OUTPUT}`)

  if (runState.paused) {
    const nLeft = Object.keys(runState.ingest_progress).length + subset.filter(i => !runState.completed_items[i.question_id]).length
    console.log("\n⚠  Run paused due to rate limit.")
    console.log(`   ${Object.keys(runState.completed_items).length}/${subset.length} items completed, state saved to:`)
    console.log(`   ${STATE_FILE}`)
    console.log("\n   Resume with the same flags plus --run-id:")
    console.log(`   bun run bench:docker-smoke -- --run-id ${RUN_ID} --limit ${LIMIT} --batch-size ${BATCH_SIZE}${MAX_SESSIONS ? ` --max-sessions ${MAX_SESSIONS}` : ""}`)
  } else {
    // Clean up state file on successful completion
    if (existsSync(STATE_FILE)) {
      try {
        const { unlinkSync } = await import("node:fs")
        unlinkSync(STATE_FILE)
        console.log(`State file removed (run complete).`)
      } catch { /* ignore */ }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
