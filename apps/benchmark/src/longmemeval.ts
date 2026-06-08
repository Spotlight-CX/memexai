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
  retrieval_latency_ms: number
  end_to_end_latency_ms: number
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  search_mode: string | null
  trace_id: string | null
  tool_call_id: string | null
  ingest_trace_ids: string[]
  written: boolean
  retrieved: boolean
  cited: boolean
  answerable: boolean
  operator_explainable: boolean
  error?: string
}

type AgenticSearchResult = {
  answer?: string
  query: string
  results: { path: string; snippet: string; rank: number }[]
  sources?: string[]
  traceId?: string
  memory_trace_id?: string
  toolCallId?: string
  durationMs?: number
  usage?: {
    inputTokens?: number | null
    outputTokens?: number | null
    totalTokens?: number | null
  }
  searchStats?: {
    searchMode?: string
    candidateCount?: number
    filesReturned?: number
    filesRead?: number
    sourcesReturned?: number
  }
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

function percent(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0
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
    const ingest_trace_ids: string[] = []
    let wroteMemory = false

    try {
      // ── Ingest ──────────────────────────────────────────────────────────────
      if (!SKIP_INGEST) {
        const existing = await user.list("user/")
        if (existing.files.length > 0) {
          process.stdout.write(" [already ingested]")
        } else {
          const t0 = Date.now()
          const total = item.haystack_sessions.length
          for (let s = 0; s < total; s++) {
            process.stdout.write(`\n  session ${s + 1}/${total} …`)
            const st = Date.now()
            const text = formatSession(
              item.haystack_sessions[s],
              item.haystack_dates[s] ?? "unknown date",
            )
            const result = await user.remember(text, { maxWrites: 3, dryRun: DRY_RUN })
            if (result.traceId) ingest_trace_ids.push(result.traceId)
            wroteMemory ||= result.writes.length > 0
            process.stdout.write(` ${Date.now() - st}ms (${result.writes.length} writes)`)
          }
          ingest_ms = Date.now() - t0
          process.stdout.write(`\n  ingest done — ${total} sessions, ${ingest_ms}ms total`)
        }
      }

      // ── Query ────────────────────────────────────────────────────────────────
      const t1 = Date.now()
      const searchResult = await user.executeTool<AgenticSearchResult>(
        "memory_find",
        { query: item.question, limit: 5 },
      )
      const query_ms = Date.now() - t1

      // memory_find returns ranked results; concatenate snippets as predicted answer
      predicted = searchResult.answer
        ?? searchResult.results.map(r => r.snippet).join(" ")

      const trace_id = searchResult.traceId ?? searchResult.memory_trace_id ?? null
      const tool_call_id = searchResult.toolCallId ?? null
      const retrieved = searchResult.results.length > 0 || (searchResult.sources?.length ?? 0) > 0
      const cited = (searchResult.sources?.length ?? 0) > 0 || /user\/|shared\//.test(searchResult.answer ?? "")
      const answerable = Boolean(predicted.trim())
      const operator_explainable = Boolean(trace_id && tool_call_id)

      const { em, f1 } = score(predicted, item.answer)
      totalEM += em
      totalF1 += f1
      process.stdout.write(` query=${query_ms}ms EM=${em} F1=${f1.toFixed(2)}\n`)

      results.push({
        question_id: item.question_id,
        question_type: item.question_type,
        question: item.question,
        expected: item.answer,
        predicted,
        em,
        f1,
        ingest_ms,
        query_ms,
        retrieval_latency_ms: searchResult.durationMs ?? query_ms,
        end_to_end_latency_ms: query_ms,
        input_tokens: searchResult.usage?.inputTokens ?? null,
        output_tokens: searchResult.usage?.outputTokens ?? null,
        total_tokens: searchResult.usage?.totalTokens ?? null,
        search_mode: searchResult.searchStats?.searchMode ?? null,
        trace_id,
        tool_call_id,
        ingest_trace_ids,
        written: SKIP_INGEST ? true : wroteMemory,
        retrieved,
        cited,
        answerable,
        operator_explainable,
      })
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      errors++
      process.stdout.write(` ERROR: ${error}\n`)
      results.push({
        question_id: item.question_id,
        question_type: item.question_type,
        question: item.question,
        expected: item.answer,
        predicted: "",
        em: 0,
        f1: 0,
        ingest_ms,
        query_ms: 0,
        retrieval_latency_ms: 0,
        end_to_end_latency_ms: 0,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        search_mode: null,
        trace_id: null,
        tool_call_id: null,
        ingest_trace_ids,
        written: wroteMemory,
        retrieved: false,
        cited: false,
        answerable: false,
        operator_explainable: false,
        error,
      })
    }
  }

  await memex.end()

  // ── Summary ───────────────────────────────────────────────────────────────────
  const n = subset.length
  console.log("\n=== Results ===")
  console.log(`Items:       ${n}  (${errors} errors)`)
  console.log(`Exact Match: ${((totalEM / n) * 100).toFixed(1)}%`)
  console.log(`F1:          ${((totalF1 / n) * 100).toFixed(1)}%`)
  console.log(`Explainable: ${(percent(results.filter((r) => r.operator_explainable).length, n)).toFixed(1)}%`)

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
      reliability: {
        written: percent(results.filter((r) => r.written).length, n) / 100,
        retrieved: percent(results.filter((r) => r.retrieved).length, n) / 100,
        cited: percent(results.filter((r) => r.cited).length, n) / 100,
        answerable: percent(results.filter((r) => r.answerable).length, n) / 100,
        operator_explainable: percent(results.filter((r) => r.operator_explainable).length, n) / 100,
      },
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
