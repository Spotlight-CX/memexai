#!/usr/bin/env bun
/// <reference types="node" />
/**
 * E2E test runner — executes the scenario defined in scenario.ts.
 * Run: bun run test:e2e   (or: bun scripts/e2e/run.ts)
 */

import { CONFIG, SCENARIO, type RecallCase } from "./scenario.js"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

// Auto-load .env (strips quotes, lowest priority — process.env wins)
function loadDotEnv() {
  try {
    const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env")
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const [key, ...rest] = line.split("=")
      if (key && rest.length && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "")
      }
    }
  } catch { /* no .env, that's fine */ }
}
loadDotEnv()

// Re-read config after .env is loaded (CONFIG is evaluated at import time above,
// but process.env may now have the values — re-derive the mutable parts).
const serviceUrl  = process.env.MEMEX_SERVICE_URL ?? CONFIG.serviceUrl
const apiKey      = process.env.MEMEX_API_KEY     ?? CONFIG.apiKey
const adminSecret = process.env.MEMEX_ADMIN_SECRET ?? CONFIG.adminSecret
const geminiKey   = process.env.GEMINI_API_KEY     ?? CONFIG.geminiKey

// ── API helpers ────────────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>, userId: string) {
  const res = await fetch(`${serviceUrl}/v1/tools/${name}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ context: { userId }, arguments: args }),
  })
  if (!res.ok) throw new Error(`${name} → HTTP ${res.status}: ${await res.text()}`)
  return res.json() as Promise<Record<string, unknown>>
}

async function adminWrite(virtualPath: string, content: string) {
  const res = await fetch(`${serviceUrl}/v1/admin/files/${virtualPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error(`admin write ${virtualPath} → HTTP ${res.status}: ${await res.text()}`)
}

// ── assertion helpers ──────────────────────────────────────────────────────

function isSimple(tc: RecallCase): tc is Extract<RecallCase, { mustContainAny: string[] }> {
  return "mustContainAny" in tc
}

function checkKeywords(text: string, kws: string[]) {
  const lower = text.toLowerCase()
  return {
    coverage: kws.filter((k) => lower.includes(k.toLowerCase())).length / kws.length,
    missing:  kws.filter((k) => !lower.includes(k.toLowerCase())),
  }
}

async function runLlmJudge(recallContexts: string[]): Promise<{ pass: boolean; score: number; reason: string } | null> {
  if (!geminiKey) return null
  const rubric       = SCENARIO.judgeRubric.map((r, i) => `${i + 1}. ${r}`).join("\n")
  const recallBlocks = SCENARIO.recalls.map((tc, i) =>
    `${tc.label} ("${tc.query}"):\n"""\n${recallContexts[i] ?? "(no result)"}\n"""`
  ).join("\n\n")

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.judgeModel}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: `\
You are evaluating a memory recall system. The user stored this:
"""
${SCENARIO.seed}
"""

${recallBlocks}

Score against this rubric (each item ~1.4 points toward 10):
${rubric}

Return ONLY valid JSON, no markdown:
{"pass": boolean, "score": integer 0-10, "reason": "one sentence"}` }],
        }],
      }),
    },
  )
  if (!res.ok) throw new Error(`Judge API ${res.status}: ${await res.text()}`)
  const body = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
  const raw  = body.candidates[0].content.parts[0].text.trim()
    .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return JSON.parse(raw)
}

// ── runner ─────────────────────────────────────────────────────────────────

const USER = `e2e_${Date.now()}`
const step = (() => { let n = 0; return () => `[${++n}]` })()
let overallPass = true

console.log(`\nMemexAI E2E Recall Test`)
console.log(`Service : ${serviceUrl}`)
console.log(`User    : ${USER}`)
console.log(`Judge   : ${geminiKey ? CONFIG.judgeModel : "keyword-only (no GEMINI_API_KEY)"}`)

// 1 — Health check
process.stdout.write(`\n${step()} health check ... `)
const health = await fetch(`${serviceUrl}/health`)
if (!health.ok) { console.error("FAIL — service not reachable"); process.exit(1) }
console.log("✓")

// 2 — Seed shared guidance
process.stdout.write(`${step()} seed shared guidance ... `)
await adminWrite(SCENARIO.sharedGuidance.path, SCENARIO.sharedGuidance.content)
console.log(`✓  ${SCENARIO.sharedGuidance.path}`)

// 3 — memory_remember
process.stdout.write(`${step()} memory_remember ... `)
const t0 = Date.now()
const seedResult = await callTool("memory_remember", { text: SCENARIO.seed, dryRun: false }, USER)
const writes = (seedResult.writes ?? []) as Array<{ path: string; args?: { content?: string } }>
console.log(`✓  ${writes.length} files written  (${Date.now() - t0}ms)`)
if (!writes.length) { console.error("  No writes produced — aborting"); process.exit(1) }

const writtenPaths   = new Set(writes.map((w) => w.path))
const writtenContent = new Map(writes.map((w) => [w.path, w.args?.content ?? ""]))

// 4 — Write routing verification
console.log(`${step()} write routing ...`)
let writeHits = 0
for (const expected of SCENARIO.expectedWrites) {
  const hit     = writtenPaths.has(expected.path)
  const content = writtenContent.get(expected.path) ?? ""
  const kw      = checkKeywords(content, expected.mustContain)
  const ok      = hit && kw.coverage === 1

  const icon   = ok ? "✓" : hit ? "~" : "✗"
  const detail = !hit
    ? "not written  ← guidance not followed"
    : kw.missing.length
      ? `missing content: ${kw.missing.join(", ")}`
      : "content ok"
  console.log(`     ${icon}  ${expected.path.padEnd(22)}  ${expected.description}  (${detail})`)
  if (ok) writeHits++
}
const writesOk = writeHits / SCENARIO.expectedWrites.length >= CONFIG.writePassThreshold
console.log(`     ${writesOk ? "✓" : "✗"}  ${writeHits}/${SCENARIO.expectedWrites.length} files routed correctly`)
if (!writesOk) overallPass = false

// 5+ — Recalls
const recallContexts: string[] = []
const writtenUserFiles = [...writtenPaths].filter((p) => p.startsWith("user/") && !p.endsWith("log.md"))

for (const tc of SCENARIO.recalls) {
  process.stdout.write(`${step()} ${tc.label} ... `)
  const t1        = Date.now()
  const result    = await callTool("memory_context", { query: tc.query }, USER)
  const ctx       = result.context as string
  const filesRead = (result.filesRead as string[]) ?? []
  recallContexts.push(ctx)

  if (isSimple(tc)) {
    const hit            = tc.mustContainAny.some((k) => ctx.toLowerCase().includes(k.toLowerCase()))
    const symmetryMissed = (tc.mustReadFrom ?? []).filter((f) => !filesRead.includes(f))
    const ok             = hit && symmetryMissed.length === 0

    console.log(`${ok ? "✓" : hit ? "~" : "✗"}  ${filesRead.length} files read  (${Date.now() - t1}ms)`)
    if (!hit)                  console.log(`     expected one of: [${tc.mustContainAny.join(", ")}]`)
    if (symmetryMissed.length) console.log(`     read/write gap — not read: ${symmetryMissed.join(", ")}`)
    if (!ok) overallPass = false

  } else {
    const kw      = checkKeywords(ctx, tc.mustContain)
    const pct     = Math.round(kw.coverage * 100)
    const kwOk    = kw.coverage >= CONFIG.recallPassThreshold
    const filesOk = !tc.minFilesRead || filesRead.length >= tc.minFilesRead

    // Read/write symmetry: what fraction of written user files were read back?
    const overlap     = writtenUserFiles.filter((p) => filesRead.includes(p))
    const symmetryPct = writtenUserFiles.length ? Math.round((overlap.length / writtenUserFiles.length) * 100) : 100

    const ok = kwOk && filesOk
    console.log(`${ok ? "✓" : "~"}  ${pct}% keywords  •  ${filesRead.length} files read  •  ${symmetryPct}% read↔write overlap  (${Date.now() - t1}ms)`)
    if (kw.missing.length)  console.log(`     missing keywords: ${kw.missing.join(", ")}`)
    if (!filesOk)           console.log(`     files read: ${filesRead.length}, expected ≥${tc.minFilesRead}`)
    if (symmetryPct < 50)   console.log(`     read/write gap: only ${overlap.length}/${writtenUserFiles.length} written files read back`)
    if (!ok) overallPass = false
  }
}

// Final — LLM judge
process.stdout.write(`${step()} LLM judge ... `)
let judgeVerdict: { pass: boolean; score: number; reason: string } | null = null
try {
  judgeVerdict = await runLlmJudge(recallContexts)
  if (judgeVerdict) console.log(`${judgeVerdict.pass ? "✓" : "✗"}  ${judgeVerdict.score}/10 — ${judgeVerdict.reason}`)
} catch (err) {
  const msg = (err as Error).message
  console.log(msg.includes("INVALID_ARGUMENT") || msg.includes("API_KEY")
    ? "(skipped — invalid/missing API key)"
    : `(skipped: ${msg})`)
}

// Result
console.log(`\n${"─".repeat(50)}`)
console.log(`Result: ${overallPass ? "PASS ✓" : "FAIL ✗"}`)
if (judgeVerdict) console.log(`  Judge score : ${judgeVerdict.score}/10 — ${judgeVerdict.reason}`)
console.log(`${"─".repeat(50)}\n`)

if (!overallPass) process.exit(1)
