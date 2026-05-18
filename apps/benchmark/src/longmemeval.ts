#!/usr/bin/env bun
/**
 * LongMemEval benchmark for MemexAI
 *
 * Usage:
 *   OLLAMA_MODEL=gemma4 DATABASE_URL=... bun run apps/benchmark/src/longmemeval.ts [options]
 *
 * Options:
 *   --dataset <path>     Path to dataset JSON (default: ./data/longmemeval_s_cleaned.json)
 *   --limit <n>          Only run first N items
 *   --skip-ingest        Skip ingest phase — reuse existing memory (resume interrupted run)
 *   --output <path>      Results JSON output (default: ./data/results.json)
 *   --dry-run            Plan memorize writes but don't commit them
 */

import { createMemex } from "@memexai/core"
import { createOpenAI } from "@ai-sdk/openai"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

// ── CLI ───────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const arg = (flag: string) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : undefined }
const flag = (f: string) => argv.includes(f)

const DATASET  = arg("--dataset") ?? "apps/benchmark/data/longmemeval_s_cleaned.json"
const LIMIT    = arg("--limit") ? parseInt(arg("--limit")!) : undefined
const SKIP_INGEST = flag("--skip-ingest")
const OUTPUT   = arg("--output") ?? "apps/benchmark/data/results.json"
const DRY_RUN  = flag("--dry-run")

// ── Env ───────────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error("DATABASE_URL is required")

const OLLAMA_MODEL  = process.env.OLLAMA_MODEL
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434") + "/v1"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY

if (!OLLAMA_MODEL && !OPENAI_API_KEY && !GEMINI_API_KEY) {
  throw new Error("Provide OLLAMA_MODEL (recommended for local), OPENAI_API_KEY, or GEMINI_API_KEY")
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Turn = { role: "user" | "assistant"; content: string }

type BenchmarkItem = {
  question_id: string
  question_type: string
  question: string
  answer: string
  question_date: string
  haystack_dates: string[]
  haystack_sessions: Turn[][]
}

type ItemResult = {
  question_id: string
  question_type: string
  question: string
  expected: string
  predicted: string
  em: number
  f1: number
  ingest_ms: number
  query_ms: number
  error?: string
}

type AgenticSearchResult = {
  answer?: string
  query: string
  results: { path: string; snippet: string; rank: number }[]
}

// ── Dataset download ──────────────────────────────────────────────────────────

const DATASET_URLS: Record<string, string> = {
  "longmemeval_s_cleaned.json":
    "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_s_cleaned.json",
  "longmemeval_m_cleaned.json":
    "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_m_cleaned.json",
  "longmemeval_oracle.json":
    "https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned/resolve/main/longmemeval_oracle.json",
}

async function ensureDataset(path: string): Promise<void> {
  if (existsSync(path)) return

  const filename = path.split("/").pop()!
  const url = DATASET_URLS[filename]
  if (!url) {
    throw new Error(
      `Unknown dataset: ${filename}\n` +
      `Download manually from https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned\n` +
      `Known files: ${Object.keys(DATASET_URLS).join(", ")}`
    )
  }

  mkdirSync(dirname(path), { recursive: true })
  console.log(`Downloading ${filename} from HuggingFace …`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  writeFileSync(path, await res.text())
  console.log(`Saved → ${path}`)
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function normalize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean)
}

function score(predicted: string, expected: string): { em: number; f1: number } {
  const pred = normalize(predicted)
  const exp  = normalize(expected)

  const em = pred.join(" ") === exp.join(" ") ? 1 : 0
  if (pred.length === 0 || exp.length === 0) return { em, f1: em }

  const counts = new Map<string, number>()
  for (const t of pred) counts.set(t, (counts.get(t) ?? 0) + 1)

  let overlap = 0
  for (const t of exp) {
    const c = counts.get(t) ?? 0
    if (c > 0) { overlap++; counts.set(t, c - 1) }
  }

  const p = overlap / pred.length
  const r = overlap / exp.length
  const f1 = p + r === 0 ? 0 : (2 * p * r) / (p + r)
  return { em, f1 }
}

// ── Model factory ─────────────────────────────────────────────────────────────

async function buildModel(): Promise<{ provider: string; modelName: string; model: unknown }> {
  if (OLLAMA_MODEL) {
    return {
      provider: "ollama",
      modelName: OLLAMA_MODEL,
      model: createOpenAI({ baseURL: OLLAMA_BASE_URL, apiKey: "ollama" }).chat(OLLAMA_MODEL),
    }
  }
  if (OPENAI_API_KEY) {
    const { openai } = await import("@ai-sdk/openai")
    const modelName = process.env.OPENAI_MODEL ?? "gpt-4o-mini"
    return { provider: "openai", modelName, model: openai(modelName) }
  }
  const { createGoogleGenerativeAI } = await import("@ai-sdk/google")
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
  return {
    provider: "google",
    modelName,
    model: createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY! })(modelName),
  }
}

// ── Session formatter ─────────────────────────────────────────────────────────

function formatSession(session: Turn[], date: string): string {
  const lines = [`[Conversation — ${date}]`]
  for (const turn of session) {
    lines.push(`${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`)
  }
  return lines.join("\n")
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== LongMemEval Benchmark ===\n")

  await ensureDataset(DATASET)
  const items: BenchmarkItem[] = JSON.parse(readFileSync(DATASET, "utf-8"))
  const subset = LIMIT ? items.slice(0, LIMIT) : items

  const { provider, modelName, model } = await buildModel()
  console.log(`Model:    ${provider}/${modelName}`)
  console.log(`Dataset:  ${DATASET} — ${subset.length} items`)
  if (SKIP_INGEST) console.log("Mode:     skip-ingest (reusing existing memory)")
  if (DRY_RUN)    console.log("Mode:     dry-run (no writes committed)")
  console.log()

  const memex = createMemex({ databaseUrl: DATABASE_URL!, model })
  await memex.migrate()

  const results: ItemResult[] = []
  let totalEM = 0, totalF1 = 0, errors = 0

  for (let i = 0; i < subset.length; i++) {
    const item = subset[i]
    const userId = `lme_${item.question_id}`
    const user = memex.forUser({ userId, actor: "benchmark" })

    process.stdout.write(`[${i + 1}/${subset.length}] ${item.question_id} (${item.question_type})`)

    let ingest_ms = 0
    let predicted = ""
    let error: string | undefined

    try {
      // ── Ingest ──────────────────────────────────────────────────────────────
      if (!SKIP_INGEST) {
        const existing = await user.list("user/")
        if (existing.files.length > 0) {
          process.stdout.write(" [already ingested]")
        } else {
          const t0 = Date.now()
          for (let s = 0; s < item.haystack_sessions.length; s++) {
            const text = formatSession(
              item.haystack_sessions[s],
              item.haystack_dates[s] ?? "unknown date",
            )
            await user.memorize(text, { maxWrites: 3, dryRun: DRY_RUN })
          }
          ingest_ms = Date.now() - t0
          process.stdout.write(` ingest=${ingest_ms}ms`)
        }
      }

      // ── Query ────────────────────────────────────────────────────────────────
      const t1 = Date.now()
      const searchResult = await user.executeTool<AgenticSearchResult>(
        "memory_search",
        { query: item.question, limit: 5 },
      )
      const query_ms = Date.now() - t1

      // Agentic search returns { answer }, BM25 fallback returns { results[].snippet }
      predicted = searchResult.answer
        ?? searchResult.results.map(r => r.snippet).join(" ")

      const { em, f1 } = score(predicted, item.answer)
      totalEM += em
      totalF1 += f1
      process.stdout.write(` query=${query_ms}ms EM=${em} F1=${f1.toFixed(2)}\n`)

      results.push({ question_id: item.question_id, question_type: item.question_type, question: item.question, expected: item.answer, predicted, em, f1, ingest_ms, query_ms })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      errors++
      process.stdout.write(` ERROR: ${error}\n`)
      results.push({ question_id: item.question_id, question_type: item.question_type, question: item.question, expected: item.answer, predicted: "", em: 0, f1: 0, ingest_ms, query_ms: 0, error })
    }
  }

  await memex.end()

  // ── Summary ───────────────────────────────────────────────────────────────────
  const n = subset.length
  console.log("\n=== Results ===")
  console.log(`Items:       ${n}  (${errors} errors)`)
  console.log(`Exact Match: ${((totalEM / n) * 100).toFixed(1)}%`)
  console.log(`F1:          ${((totalF1 / n) * 100).toFixed(1)}%`)

  const byType = new Map<string, { em: number; f1: number; n: number }>()
  for (const r of results) {
    const cur = byType.get(r.question_type) ?? { em: 0, f1: 0, n: 0 }
    byType.set(r.question_type, { em: cur.em + r.em, f1: cur.f1 + r.f1, n: cur.n + 1 })
  }
  console.log("\nBy type:")
  for (const [type, s] of [...byType.entries()].sort()) {
    console.log(`  ${type.padEnd(32)} EM=${((s.em / s.n) * 100).toFixed(1)}%  F1=${((s.f1 / s.n) * 100).toFixed(1)}%  (n=${s.n})`)
  }

  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, JSON.stringify({
    meta: {
      dataset: DATASET,
      model: `${provider}/${modelName}`,
      n,
      errors,
      em: totalEM / n,
      f1: totalF1 / n,
      timestamp: new Date().toISOString(),
    },
    by_type: Object.fromEntries(
      [...byType.entries()].map(([k, v]) => [k, { em: v.em / v.n, f1: v.f1 / v.n, n: v.n }])
    ),
    results,
  }, null, 2))
  console.log(`\nFull results → ${OUTPUT}`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
