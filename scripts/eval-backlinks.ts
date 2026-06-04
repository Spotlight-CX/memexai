#!/usr/bin/env bun
/**
 * Backlink index eval rubric.
 *
 * Tests 5 scenarios against ground truth. Each scenario seeds a fresh user
 * namespace, calls memory_smart_read or memory_search, and asserts exact
 * expectations about filesIncluded, filesIncludedMeta.reason, and ordering.
 *
 * Usage:
 *   bun scripts/eval-backlinks.ts
 *   MEMEX_URL=http://localhost:18080 MEMEX_API_KEY=dev-api-key bun scripts/eval-backlinks.ts
 */

const BASE = process.env.MEMEX_URL ?? "http://localhost:18080"
const API_KEY = process.env.MEMEX_API_KEY ?? "dev-api-key"
const ADMIN_SECRET = process.env.MEMEX_ADMIN_SECRET ?? "dev-admin-secret"

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function tool(userId: string, toolName: string, args: Record<string, unknown>) {
  const res = await fetch(`${BASE}/v1/tools/${toolName}/execute`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ context: { userId }, arguments: args }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${toolName} failed ${res.status}: ${body}`)
  }
  return res.json()
}

async function write(userId: string, path: string, content: string, reason?: string) {
  return tool(userId, "memory_write", { path, content, reason: reason ?? "eval seed" })
}

async function smartRead(userId: string, query: string, maxChars = 40_000) {
  return tool(userId, "memory_smart_read", { query, maxChars })
}

async function search(userId: string, query: string) {
  return tool(userId, "memory_search", { query, limit: 10 })
}

async function memorize(userId: string, text: string) {
  return tool(userId, "memory_memorize", { text })
}

// Each eval run gets a unique suffix so user namespaces never collide across runs.
// The admin API has no DELETE endpoint, so isolation is achieved via unique IDs.
const RUN_ID = Date.now().toString(36)

// ---------------------------------------------------------------------------
// Rubric runner
// ---------------------------------------------------------------------------

type Check = { label: string; pass: boolean; detail?: string }
type ScenarioResult = { name: string; checks: Check[]; error?: string }

function check(label: string, pass: boolean, detail?: string): Check {
  return { label, pass, detail }
}

const results: ScenarioResult[] = []

async function scenario(name: string, fn: () => Promise<Check[]>) {
  try {
    const checks = await fn()
    results.push({ name, checks })
  } catch (err) {
    results.push({ name, checks: [], error: String(err) })
  }
}

// ---------------------------------------------------------------------------
// SCENARIO 1: Pure inbound discovery
// Hub has no outbound links. Three notes link TO it.
// Smart read seeds hub via BM25 → backward expansion finds all three notes.
// ---------------------------------------------------------------------------

await scenario("S1 · Pure inbound: hub seeded → inbound notes surface", async () => {
  const userId = `eval_s1_${RUN_ID}`

  // Hub — no WikiLinks outward
  await write(userId, "user/preferences.md",
    "# Apartment Preferences\n\n- 2BHK, Whitefield\n- Budget ₹1.2Cr\n- Ground floor only\n- 2 car parking required")

  // Three inbound notes — all link TO preferences.md
  await write(userId, "user/visits/jan.md",
    "# Jan visit\nConfirmed [[user/preferences.md]] — 2BHK on target. Liked Prestige Elgin layout.")
  await write(userId, "user/visits/feb.md",
    "# Feb visit\n[[user/preferences.md]] holds. Brigade Metropolis: bad natural light.")
  await write(userId, "user/visits/mar.md",
    "# Mar update\nUpdated [[user/preferences.md]]: ground floor hard requirement after knee injury.")

  const result = await smartRead(userId, "apartment preferences 2BHK Whitefield")

  const included: string[] = result.filesIncluded
  const meta: Array<{ path: string; reason: string; linkedFrom?: string; depth: number }> = result.filesIncludedMeta

  const hubIncluded = included.includes("user/preferences.md")
  const allNotesIncluded = ["user/visits/jan.md", "user/visits/feb.md", "user/visits/mar.md"].every(p => included.includes(p))
  const hubMeta = meta.find(m => m.path === "user/preferences.md")
  const inboundMetas = meta.filter(m => m.reason === "inbound_link")
  const allInboundLinkedFrom = inboundMetas.every(m => m.linkedFrom === "user/preferences.md")
  const allInboundDepth1 = inboundMetas.every(m => m.depth === 1)
  const hubFirst = included[0] === "user/preferences.md"

  return [
    check("hub in filesIncluded", hubIncluded),
    check("all 3 inbound visit notes included", allNotesIncluded, `got: ${included.join(", ")}`),
    check("hub reason=query_match depth=0", hubMeta?.reason === "query_match" && hubMeta.depth === 0),
    check("visit notes reason=inbound_link", inboundMetas.length === 3, `got ${inboundMetas.length} inbound_link`),
    check("inbound linkedFrom=preferences.md", allInboundLinkedFrom),
    check("inbound depth=1", allInboundDepth1),
    check("hub is filesIncluded[0]", hubFirst),
  ]
})

// ---------------------------------------------------------------------------
// SCENARIO 2: Forward link wins over inbound (deduplication)
// A → B (forward WikiLink), B → A (backward WikiLink).
// Forward traversal claims B first → reason must be "linked", not "inbound_link".
// ---------------------------------------------------------------------------

await scenario("S2 · Dedup: forward link wins when file is reachable both ways", async () => {
  const userId = `eval_s2_${RUN_ID}`

  await write(userId, "user/hub.md",
    "# Hub\nCore context. See details: [[user/detail.md]]")
  await write(userId, "user/detail.md",
    "# Detail\nExtra info. See hub: [[user/hub.md]]")

  const result = await smartRead(userId, "hub context details")

  const meta: Array<{ path: string; reason: string }> = result.filesIncludedMeta
  const detailMeta = meta.find(m => m.path === "user/detail.md")
  const bothIncluded = result.filesIncluded.includes("user/hub.md") && result.filesIncluded.includes("user/detail.md")
  const noDuplicates = result.filesIncluded.filter((p: string) => p === "user/detail.md").length === 1

  return [
    check("both hub and detail included", bothIncluded, `got: ${result.filesIncluded.join(", ")}`),
    check("detail appears exactly once (no duplicate)", noDuplicates),
    check("detail reason=linked (forward wins, not inbound_link)", detailMeta?.reason === "linked", `got reason=${detailMeta?.reason}`),
  ]
})

// ---------------------------------------------------------------------------
// SCENARIO 3: Recency ordering of inbound links
// Three inbound notes with different timestamps. Most recent must rank first.
// ---------------------------------------------------------------------------

await scenario("S3 · Recency: most recently updated inbound link ranks first", async () => {
  const userId = `eval_s3_${RUN_ID}`

  await write(userId, "user/prefs.md",
    "# Preferences\n- 2BHK Sarjapur Road\n- Budget ₹1.1Cr")

  // Write in reverse order so recency is controlled by insertion time
  await write(userId, "user/note-old.md",
    "# Old note\n[[user/prefs.md]] confirmed Jan 10.")
  // Small delay to ensure different updated_at
  await new Promise(r => setTimeout(r, 600))
  await write(userId, "user/note-mid.md",
    "# Mid note\n[[user/prefs.md]] confirmed Feb 5.")
  await new Promise(r => setTimeout(r, 600))
  await write(userId, "user/note-new.md",
    "# New note\n[[user/prefs.md]] updated Mar 20 — ground floor required.")

  const result = await smartRead(userId, "preferences Sarjapur 2BHK")

  const included: string[] = result.filesIncluded
  const newIdx = included.indexOf("user/note-new.md")
  const midIdx = included.indexOf("user/note-mid.md")
  const oldIdx = included.indexOf("user/note-old.md")
  const allPresent = newIdx !== -1 && midIdx !== -1 && oldIdx !== -1

  return [
    check("all 3 inbound notes included", allPresent, `got: ${included.join(", ")}`),
    check("newest inbound ranks before mid", newIdx < midIdx, `newIdx=${newIdx} midIdx=${midIdx}`),
    check("mid inbound ranks before oldest", midIdx < oldIdx, `midIdx=${midIdx} oldIdx=${oldIdx}`),
  ]
})

// ---------------------------------------------------------------------------
// SCENARIO 4: importance_score boosts hub in memory_search
// Hub file has 3 inbound links (importance_score=3).
// Orphan has 0. Both match the same query.
// Hub must appear first with importanceScore > 0.
// ---------------------------------------------------------------------------

await scenario("S4 · Hub scoring: importance_score boosts hub in memory_search", async () => {
  const userId = `eval_s4_${RUN_ID}`

  await write(userId, "user/hub.md",
    "# Hub File\nThis is the central knowledge file about apartments in Bengaluru.")
  await write(userId, "user/orphan.md",
    "# Orphan File\nThis file is about apartments in Bengaluru and has no incoming links.")

  // 3 notes pointing to hub but NOT to orphan
  for (let i = 1; i <= 3; i++) {
    await write(userId, `user/note-${i}.md`,
      `# Note ${i}\nUpdate to [[user/hub.md]] — detail ${i}.`)
  }

  const result = await search(userId, "apartments Bengaluru")

  const searchResults: Array<{ path: string; importanceScore: number }> = result.results
  const hubResult = searchResults.find(r => r.path === "user/hub.md")
  const orphanResult = searchResults.find(r => r.path === "user/orphan.md")
  const hubBeforeOrphan = searchResults.findIndex(r => r.path === "user/hub.md") <
    searchResults.findIndex(r => r.path === "user/orphan.md")

  return [
    check("hub in search results", !!hubResult, `results: ${searchResults.map(r => r.path).join(", ")}`),
    check("orphan in search results", !!orphanResult),
    check("hub.importanceScore=3", hubResult?.importanceScore === 3, `got ${hubResult?.importanceScore}`),
    check("orphan.importanceScore=0", orphanResult?.importanceScore === 0, `got ${orphanResult?.importanceScore}`),
    check("hub ranks before orphan (importance boost)", hubBeforeOrphan),
  ]
})

// ---------------------------------------------------------------------------
// SCENARIO 5: memory_memorize writes WikiLinks → inbound_link surfaces
//
// Pre-seed a hub file (user/profile.md) so the LLM has a known target.
// Memorize a visit note and explicitly instruct it to link back via WikiLink.
// Verify:
//   a) the written content contains [[user/profile.md]]
//   b) subsequent smart_read seeds profile.md and surfaces the note as inbound_link
// ---------------------------------------------------------------------------

await scenario("S5 · Memorize: WikiLink in written content → inbound_link in smart_read", async () => {
  const userId = `eval_s5_${RUN_ID}`

  // Known hub seeded first
  await write(userId, "user/profile.md",
    "# Rohan — Property Search\n\n- 3BHK villa, Yelahanka or Hebbal\n- Budget ₹2.5–3Cr\n- Ground floor, 3 car parking\n- Commute: Manyata Tech Park")

  // Memorize a visit note — explicit WikiLink instruction in the text
  const memResult = await memorize(userId,
    "Rohan visited Brigade Orchards today. He loved the location and the green spaces. " +
    "It fits all his requirements exactly and he has shortlisted it. " +
    "Store this as a visit note at user/visit-brigade.md and include [[user/profile.md]] " +
    "as a WikiLink so it connects to his main profile.")

  // Inspect what was actually written
  const writes: Array<{ path: string; args?: { content?: string } }> = memResult.writes ?? []
  const writtenContents = writes.map(w => w.args?.content ?? "").join("\n")
  const containsWikiLink = writtenContents.includes("[[user/profile.md]]")

  // Query targets profile.md specifically (all terms present there).
  // profile.md seeds → backward expansion finds visit note as inbound_link.
  const readResult = await smartRead(userId, "Rohan villa Yelahanka ground floor")
  const meta: Array<{ path: string; reason: string }> = readResult.filesIncludedMeta
  const hasInboundLink = meta.some(m => m.reason === "inbound_link")
  const profileIncluded = readResult.filesIncluded.includes("user/profile.md")

  return [
    check("memorize wrote ≥2 files (hub + visit note)", writes.length >= 2, `wrote: ${writes.map(w => w.path).join(", ")}`),
    check("written content contains [[user/profile.md]] WikiLink", containsWikiLink,
      `writtenPaths: ${writes.map(w => w.path).join(", ")}`),
    check("profile.md in smart_read filesIncluded", profileIncluded, `got: ${readResult.filesIncluded.join(", ")}`),
    check("at least one inbound_link in smart_read (backlink indexed)", hasInboundLink,
      `reasons: ${meta.map(m => `${m.path}=${m.reason}`).join(", ")}`),
  ]
})

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const PASS = "\x1b[32m✓\x1b[0m"
const FAIL = "\x1b[31m✗\x1b[0m"
const DIM  = "\x1b[2m"
const RESET = "\x1b[0m"

let totalPass = 0
let totalFail = 0

console.log("\n╔══════════════════════════════════════════════════════════╗")
console.log("║          BACKLINK INDEX — EVAL RUBRIC RESULTS           ║")
console.log("╚══════════════════════════════════════════════════════════╝\n")

for (const r of results) {
  if (r.error) {
    console.log(`${FAIL} ${r.name}`)
    console.log(`   ${DIM}ERROR: ${r.error}${RESET}\n`)
    totalFail++
    continue
  }
  const scenarioPass = r.checks.every(c => c.pass)
  console.log(`${scenarioPass ? PASS : FAIL} ${r.name}`)
  for (const c of r.checks) {
    const icon = c.pass ? PASS : FAIL
    const detail = c.detail && !c.pass ? `  ${DIM}→ ${c.detail}${RESET}` : ""
    console.log(`   ${icon} ${c.label}${detail}`)
    if (c.pass) totalPass++; else totalFail++
  }
  console.log()
}

const total = totalPass + totalFail
console.log(`══════════════════════════════════════════════════════════`)
console.log(`  ${totalPass}/${total} checks passed`)
if (totalFail === 0) {
  console.log(`  \x1b[32mAll scenarios pass ✓\x1b[0m`)
} else {
  console.log(`  \x1b[31m${totalFail} check(s) failed\x1b[0m`)
}
console.log(`══════════════════════════════════════════════════════════\n`)

process.exit(totalFail > 0 ? 1 : 0)
