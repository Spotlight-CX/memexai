#!/usr/bin/env node
/**
 * Docker service smoke eval for MemexAI.
 *
 * Usage:
 *   node apps/benchmark/src/docker-smoke-eval.mjs --limit 1 --max-sessions 10 --batch-size 1
 *
 * This talks to the running MemexAI HTTP service, not direct Postgres.
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

async function runItem(item, index, totalItems) {
  const context = { userId: userIdFor(item), actor: "docker-smoke-eval" }
  const prefix = `[${index + 1}/${totalItems} ${item.question_id}]`
  const log = (message) => console.log(`${prefix} ${message}`)

  log(`start (${item.question_type})`)

  let ingestMs = 0
  let queryMs = 0
  let predicted = ""
  let sessionsIngested = 0

  try {
    if (!SKIP_INGEST) {
      const sessions = MAX_SESSIONS
        ? item.haystack_sessions.slice(0, MAX_SESSIONS)
        : item.haystack_sessions
      const totalAvailable = item.haystack_sessions.length
      const total = sessions.length
      const ingestStart = Date.now()

      for (let s = 0; s < total; s++) {
        const sessionLabel = `session ${s + 1}/${total}${total < totalAvailable ? `/${totalAvailable}` : ""}`
        log(`${sessionLabel} start`)
        const sessionStart = Date.now()
        const text = formatSession(
          sessions[s],
          item.haystack_dates[s] ?? "unknown date",
        )
        const result = await executeTool("memory_memorize", context, {
          text,
          maxWrites: 3,
          dryRun: DRY_RUN,
        })
        sessionsIngested++
        log(`${sessionLabel} done - ${Date.now() - sessionStart}ms (${result.writes.length} writes)`)
      }

      ingestMs = Date.now() - ingestStart
      log(`ingest done - ${total} sessions, ${ingestMs}ms total`)
    }

    const queryStart = Date.now()
    log("query start")
    const searchResult = await executeTool("memory_search", context, {
      query: item.question,
      limit: 5,
    })
    queryMs = Date.now() - queryStart

    predicted = searchResult.answer
      ?? searchResult.results.map((result) => result.snippet).join(" ")

    const { em, f1 } = score(predicted, item.answer)
    log(`query done - ${queryMs}ms EM=${em} F1=${f1.toFixed(2)}`)

    return {
      question_id: item.question_id,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`ERROR: ${message}`)
    return {
      question_id: item.question_id,
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

async function main() {
  console.log("=== MemexAI Docker Smoke Eval ===\n")
  console.log(`Service:  ${MEMEX_URL}`)
  console.log(`Dataset:  ${DATASET}`)
  console.log(`Limit:    ${LIMIT}`)
  console.log(`Sessions: ${MAX_SESSIONS ? `first ${MAX_SESSIONS} per item` : "all per item"}`)
  console.log(`Batch:    ${BATCH_SIZE} item${BATCH_SIZE === 1 ? "" : "s"}`)
  console.log(`Run ID:   ${RUN_ID}`)
  if (SKIP_INGEST) console.log("Mode:     skip-ingest")
  if (DRY_RUN) console.log("Mode:     dry-run")
  console.log()

  await checkHealth()
  await ensureDataset(DATASET)

  const items = JSON.parse(readFileSync(DATASET, "utf-8"))
  const subset = items.slice(0, LIMIT)
  const results = await mapWithConcurrency(subset, BATCH_SIZE, (item, index) => runItem(item, index, subset.length))

  const summary = summarize(results)

  console.log("\n=== Results ===")
  console.log(`Items:       ${results.length}  (${summary.errors} errors)`)
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
      n: results.length,
      errors: summary.errors,
      em: summary.em,
      f1: summary.f1,
      skip_ingest: SKIP_INGEST,
      dry_run: DRY_RUN,
      max_sessions_per_item: MAX_SESSIONS ?? null,
      batch_size: BATCH_SIZE,
      timestamp: new Date().toISOString(),
    },
    by_type: Object.fromEntries(
      [...summary.byType.entries()].map(([type, value]) => [
        type,
        { em: value.em / value.n, f1: value.f1 / value.n, n: value.n },
      ]),
    ),
    results,
  }, null, 2))
  console.log(`\nFull results -> ${OUTPUT}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
