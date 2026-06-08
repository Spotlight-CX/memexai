#!/usr/bin/env bun
/**
 * MemexAI E2E recall quality test.
 * Run after a clean rebuild: bun run test:e2e
 * Override defaults: MEMEX_SERVICE_URL=http://... MEMEX_API_KEY=... bun run test:e2e
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// ── config ─────────────────────────────────────────────────────────────────

function envKey(key: string) {
  if (process.env[key]) return process.env[key]
  try {
    const line = readFileSync(resolve(import.meta.dir, "../.env"), "utf8")
      .split("\n").find((l) => l.startsWith(`${key}=`))
    return line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "")
  } catch { return undefined }
}

const CONFIG = {
  serviceUrl:  envKey("MEMEX_SERVICE_URL") ?? "http://localhost:18080",
  apiKey:      envKey("MEMEX_API_KEY")     ?? "dev-api-key",
  geminiKey:   envKey("GEMINI_API_KEY"),
  judgeModel:  "gemini-2.5-flash",
  passThreshold: 0.8,  // ≥80% of expected facts must appear in the complex recall
}

// ── scenario ───────────────────────────────────────────────────────────────
// Everything the test cares about lives here.
// Add recall cases or expected facts here — no need to touch the runner below.

const SCENARIO = {
  // What to store — semantically rich, multi-topic, cross-file
  seed: `
    My name is Arjun. I'm looking for a 2BHK apartment in Indiranagar or Koramangala.
    My total budget is 1.2 crore. I prefer floors 4 and above.

    Family: wife Meera who is allergic to dust (needs good ventilation), kids Aarav (age 9)
    and Priya (age 6) who attend school near Indiranagar. We have a golden retriever named Max —
    the apartment must allow pets.

    I visited Prestige Tranquility last week. Liked the layout and natural light but the asking
    price was 1.45 crore, which is above budget.
  `.trim().replace(/^ {4}/gm, ""),

  recalls: [
    {
      label: "Simple — single-fact budget recall",
      query: "what is my apartment budget?",
      // Pass if ANY of these appear in the returned context
      mustContainAny: ["1.2", "crore"],
    },
    {
      label: "Complex — multi-topic full profile",
      query: "apartment requirements, family members, health constraints, visited properties, budget",
      // Keyword coverage gate: ≥ CONFIG.passThreshold of these must appear
      mustContain: [
        "2BHK",          // apartment type
        "Indiranagar",   // preferred location
        "Koramangala",   // preferred location
        "1.2",           // budget figure
        "floor",         // floor preference
        "Meera",         // family member
        "dust",          // health constraint
        "ventilation",   // health constraint
        "Aarav",         // child
        "Priya",         // child
        "school",        // child constraint
        "Max",           // pet name
        "pet",           // pet constraint
        "Prestige",      // visited property name
        "1.45",          // visited property price (over budget)
      ],
    },
  ],

  // What the LLM judge checks holistically (one call, both recalls evaluated together)
  judgeRubric: [
    "budget (1.2 crore) appears clearly in the simple recall",
    "complex recall covers: location (Indiranagar/Koramangala)",
    "complex recall covers: floor preference",
    "complex recall covers: family members (Meera, Aarav, Priya)",
    "complex recall covers: health constraint (dust allergy, ventilation)",
    "complex recall covers: pet (dog Max, pet-friendly requirement)",
    "complex recall covers: visited property (Prestige Tranquility, 1.45 crore, over budget)",
  ],
}

// ── helpers ────────────────────────────────────────────────────────────────

const TEST_USER = `e2e_${Date.now()}`

async function callTool(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${CONFIG.serviceUrl}/v1/tools/${name}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.apiKey}` },
    body: JSON.stringify({ context: { userId: TEST_USER }, arguments: args }),
  })
  if (!res.ok) throw new Error(`${name} → HTTP ${res.status}: ${await res.text()}`)
  return res.json() as Promise<Record<string, unknown>>
}

function checkKeywords(context: string, keywords: string[]) {
  const lower = context.toLowerCase()
  const found   = keywords.filter((k) => lower.includes(k.toLowerCase()))
  const missing = keywords.filter((k) => !lower.includes(k.toLowerCase()))
  return { coverage: found.length / keywords.length, found, missing }
}

async function runLlmJudge(simpleContext: string, complexContext: string) {
  if (!CONFIG.geminiKey) return null
  const rubric = SCENARIO.judgeRubric.map((r, i) => `${i + 1}. ${r}`).join("\n")
  const prompt = `\
You are evaluating a memory recall system. The user stored this:

"""
${SCENARIO.seed}
"""

Simple recall ("${SCENARIO.recalls[0].query}"):
"""
${simpleContext}
"""

Complex recall ("${SCENARIO.recalls[1].query}"):
"""
${complexContext}
"""

Score against this rubric (each item is worth ~1.4 points toward 10):
${rubric}

Return ONLY valid JSON, no markdown:
{"pass": boolean, "score": integer 0-10, "reason": "one sentence"}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.judgeModel}:generateContent?key=${CONFIG.geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    },
  )
  if (!res.ok) throw new Error(`Judge API ${res.status}: ${await res.text()}`)
  const body = await res.json() as { candidates: { content: { parts: { text: string }[] } }[] }
  const raw  = body.candidates[0].content.parts[0].text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return JSON.parse(raw) as { pass: boolean; score: number; reason: string }
}

// ── runner ─────────────────────────────────────────────────────────────────

console.log(`\nMemexAI E2E Recall Test`)
console.log(`Service : ${CONFIG.serviceUrl}`)
console.log(`User    : ${TEST_USER}`)
console.log(`Judge   : ${CONFIG.geminiKey ? CONFIG.judgeModel : "keyword-only (no GEMINI_API_KEY)"}`)

// 1. Health check
process.stdout.write("\n[1] health check ... ")
const health = await fetch(`${CONFIG.serviceUrl}/health`)
if (!health.ok) { console.error(`FAIL — service not reachable`); process.exit(1) }
console.log("✓")

// 2. Seed
process.stdout.write("[2] memory_remember ... ")
const t0 = Date.now()
const seedResult = await callTool("memory_remember", { text: SCENARIO.seed, dryRun: false })
const writeCount = (seedResult.writes as unknown[])?.length ?? 0
console.log(`✓  ${writeCount} files written  (${Date.now() - t0}ms)`)
if (writeCount === 0) { console.error("  No writes produced — aborting"); process.exit(1) }

// 3. Recalls
const recallContexts: string[] = []
let allRecallsOk = true

for (const [i, tc] of SCENARIO.recalls.entries()) {
  process.stdout.write(`[${i + 3}] ${tc.label} ... `)
  const t1 = Date.now()
  const result  = await callTool("memory_context", { query: tc.query })
  const context = result.context as string
  const files   = (result.filesRead as string[]) ?? []
  recallContexts.push(context)

  if ("mustContainAny" in tc) {
    // Simple: any one match is a pass
    const hit = tc.mustContainAny.some((k) => context.toLowerCase().includes(k.toLowerCase()))
    console.log(`${hit ? "✓" : "✗"}  ${files.length} files  (${Date.now() - t1}ms)`)
    if (!hit) {
      console.log(`     expected one of: ${tc.mustContainAny.join(", ")}`)
      allRecallsOk = false
    }
  } else {
    // Complex: keyword coverage gate
    const kw = checkKeywords(context, tc.mustContain!)
    const pct = Math.round(kw.coverage * 100)
    const pass = kw.coverage >= CONFIG.passThreshold
    console.log(`${pass ? "✓" : "~"}  ${pct}% keyword coverage  (${files.length} files, ${Date.now() - t1}ms)`)
    if (kw.missing.length) console.log(`     missing: ${kw.missing.join(", ")}`)
    if (!pass) allRecallsOk = false
  }
}

// 4. LLM judge (one call, optional)
process.stdout.write(`[${SCENARIO.recalls.length + 3}] LLM judge ... `)
let judgeRan = false
let judgeVerdict: { pass: boolean; score: number; reason: string } | null = null
try {
  judgeVerdict = await runLlmJudge(recallContexts[0], recallContexts[1])
  judgeRan = true
  console.log(`${judgeVerdict.pass ? "✓" : "✗"}  ${judgeVerdict.score}/10 — ${judgeVerdict.reason}`)
} catch (err) {
  const msg = (err as Error).message
  const isKeyError = msg.includes("INVALID_ARGUMENT") || msg.includes("API_KEY")
  console.log(isKeyError ? "(skipped — invalid/missing API key)" : `(skipped: ${msg})`)
}

// 5. Verdict
const passed = allRecallsOk
console.log(`\n${"─".repeat(50)}`)
console.log(`Result: ${passed ? "PASS ✓" : "FAIL ✗"}`)
if (judgeRan && judgeVerdict) console.log(`  Judge score : ${judgeVerdict.score}/10 — ${judgeVerdict.reason}`)
console.log(`${"─".repeat(50)}\n`)

if (!passed) process.exit(1)
