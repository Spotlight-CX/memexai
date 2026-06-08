#!/usr/bin/env bun
/**
 * MemexAI E2E recall quality test.
 *
 * One semantically rich remember → two recalls (simple + complex) → one LLM judge call.
 * Minimal token usage. Run after a clean rebuild.
 *
 * Usage:
 *   bun scripts/e2e-recall-test.ts
 *   MEMEX_SERVICE_URL=http://localhost:18080 bun scripts/e2e-recall-test.ts
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// Load .env from repo root (strip quotes)
function loadEnvKey(key: string): string | undefined {
  try {
    const envPath = resolve(import.meta.dir, "../.env")
    const line = readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith(`${key}=`))
    return line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "")
  } catch { return undefined }
}

const BASE    = process.env.MEMEX_SERVICE_URL ?? "http://localhost:18080"
const API_KEY = process.env.MEMEX_API_KEY ?? loadEnvKey("MEMEX_API_KEY") ?? "dev-api-key"
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? loadEnvKey("GEMINI_API_KEY")
const TEST_USER   = `e2e_${Date.now()}`
const JUDGE_MODEL = "gemini-2.5-flash"

// ── helpers ────────────────────────────────────────────────────────────────

async function tool(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${BASE}/v1/tools/${name}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ context: { userId: TEST_USER }, arguments: args }),
  })
  if (!res.ok) throw new Error(`${name} → ${res.status}: ${await res.text()}`)
  return res.json() as Promise<Record<string, unknown>>
}

function ok(label: string, detail = "") {
  console.log(`  ✓  ${label}${detail ? `  (${detail})` : ""}`)
}

function fail(label: string, reason: string) {
  console.error(`  ✗  ${label}`)
  console.error(`     ${reason}`)
}

// ── seed data ──────────────────────────────────────────────────────────────
// One rich remember payload that exercises multi-topic storage:
// preferences, family, health, pets, budget, visit history
const SEED_TEXT = `
My name is Arjun. I'm looking for a 2BHK apartment in Indiranagar or Koramangala.
My total budget is 1.2 crore. I prefer floors 4 and above.

Family: wife Meera who is allergic to dust (needs good ventilation), kids Aarav (age 9)
and Priya (age 6) who attend school near Indiranagar. We have a golden retriever named Max —
the apartment must allow pets.

I visited Prestige Tranquility last week. Liked the layout and natural light but the asking
price was 1.45 crore, which is above budget.
`.trim()

// What a good complex recall MUST contain — use broad terms, not literal phrases
const MUST_CONTAIN = [
  "2BHK",
  "Indiranagar",
  "Koramangala",
  "1.2",         // budget figure
  "floor",       // floor preference
  "Meera",
  "dust",        // allergy
  "ventilation",
  "Aarav",
  "Priya",
  "school",
  "Max",         // dog name
  "pet",
  "Prestige",    // visited property
  "1.45",        // over-budget price seen
]

// ── keyword check (no tokens) ──────────────────────────────────────────────

function keywordCheck(context: string, facts: string[]): { pass: boolean; missing: string[] } {
  const lower = context.toLowerCase()
  const missing = facts.filter((f) => !lower.includes(f.toLowerCase()))
  return { pass: missing.length === 0, missing }
}

// ── llm judge (one call, minimal tokens) ──────────────────────────────────

async function llmJudge(simpleContext: string, complexContext: string): Promise<{
  pass: boolean; score: number; reason: string
}> {
  if (!GEMINI_KEY) {
    console.log("  (GEMINI_API_KEY not set — skipping LLM judge, using keyword check only)")
    return { pass: true, score: -1, reason: "skipped" }
  }
  const prompt = `You are evaluating a memory recall system. A user stored this information:

"""
${SEED_TEXT}
"""

Two recall queries were run and returned these contexts:

SIMPLE RECALL ("what is my apartment budget?"):
"""
${simpleContext}
"""

COMPLEX RECALL ("summarise all my apartment requirements, family, health constraints, and any property I've visited"):
"""
${complexContext}
"""

Rate the quality. Return ONLY valid JSON — no markdown, no explanation outside the JSON:
{
  "pass": true if budget appears in simple recall AND the complex recall covers at least 8 of the key topics (budget, location, floor preference, family members, dust allergy, kids/school, pet, visited property),
  "score": integer 0-10,
  "reason": "one sentence"
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Judge API ${res.status}: ${body}`)
  }
  const body = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
  const raw = body.candidates[0].content.parts[0].text.trim()
  // strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return JSON.parse(json) as { pass: boolean; score: number; reason: string }
}

// ── main ───────────────────────────────────────────────────────────────────

console.log(`\nMemexAI E2E Recall Test`)
console.log(`Service : ${BASE}`)
console.log(`User    : ${TEST_USER}`)
console.log(`Judge   : ${GEMINI_KEY ? JUDGE_MODEL : "keyword-only (no GEMINI_API_KEY)"}`)

// 1. Health check
process.stdout.write("\n[1] Health check ... ")
const health = await fetch(`${BASE}/health`)
if (!health.ok) { console.error(`FAIL — service not reachable at ${BASE}`); process.exit(1) }
console.log("✓")

// 2. memory_remember — one rich write
process.stdout.write("[2] memory_remember (rich seed) ... ")
const rememberStart = Date.now()
const rememberResult = await tool("memory_remember", { text: SEED_TEXT, dryRun: false })
const writes = (rememberResult.writes as unknown[])?.length ?? 0
console.log(`✓  (${writes} writes, ${Date.now() - rememberStart}ms)`)
if (writes === 0) { console.error("  No writes produced — aborting"); process.exit(1) }

// 3. Simple recall
process.stdout.write("[3] memory_context — simple query ... ")
const simpleStart = Date.now()
const simpleResult = await tool("memory_context", { query: "what is my apartment budget?" })
const simpleContext = simpleResult.context as string
const simpleFiles  = (simpleResult.filesRead as string[]) ?? []
const simpleOk = simpleContext.toLowerCase().includes("1.2") || simpleContext.toLowerCase().includes("crore")
console.log(simpleOk ? `✓  (${simpleFiles.length} files, ${Date.now() - simpleStart}ms)` : `✗`)
if (!simpleOk) fail("simple recall", `budget not found in context: "${simpleContext.slice(0, 120)}"`)

// 4. Complex recall
process.stdout.write("[4] memory_context — complex query ... ")
const complexStart = Date.now()
const complexResult = await tool("memory_context", {
  query: "apartment requirements, family members, health constraints, visited properties, budget",
})
const complexContext = complexResult.context as string
const complexFiles   = (complexResult.filesRead as string[]) ?? []
const kw = keywordCheck(complexContext, MUST_CONTAIN)
console.log(`${kw.pass ? "✓" : "~"}  (${complexFiles.length} files, ${Date.now() - complexStart}ms)`)
if (!kw.pass) console.log(`  missing keywords: ${kw.missing.join(", ")}`)

// 5. LLM judge — one call covering both recalls (optional)
process.stdout.write("[5] LLM judge ... ")
let judgeScore = -1
let judgeReason = ""
let judgeRan = false
try {
  const verdict = await llmJudge(simpleContext, complexContext)
  judgeScore  = verdict.score
  judgeReason = verdict.reason
  judgeRan    = true
  console.log(`${verdict.pass ? "✓" : "✗"}  score ${judgeScore}/10 — ${judgeReason}`)
} catch (err) {
  const msg = (err as Error).message
  // Gracefully skip if key is invalid/missing — keyword check is the gate
  const isKeyError = msg.includes("INVALID_ARGUMENT") || msg.includes("API_KEY") || msg.includes("not set")
  console.log(isKeyError ? "(skipped — no valid direct API key)" : `(skipped: ${msg})`)
}

// 6. Final verdict — keyword gate is authoritative; judge is informational
const PASS_THRESHOLD = 0.8  // allow ≤20% keyword misses
const kwScore = (MUST_CONTAIN.length - kw.missing.length) / MUST_CONTAIN.length
const allPassed = simpleOk && kwScore >= PASS_THRESHOLD
console.log(`\n${"─".repeat(48)}`)
console.log(`Result: ${allPassed ? "PASS ✓" : "FAIL ✗"}`)
console.log(`  keyword coverage: ${Math.round(kwScore * 100)}%  (${MUST_CONTAIN.length - kw.missing.length}/${MUST_CONTAIN.length})`)
if (kw.missing.length)  console.log(`  missing: ${kw.missing.join(", ")}`)
if (judgeRan)           console.log(`  judge score: ${judgeScore}/10 — ${judgeReason}`)
console.log(`${"─".repeat(48)}\n`)

if (!allPassed) process.exit(1)
