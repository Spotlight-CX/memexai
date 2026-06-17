import {
  readFileSync, writeFileSync, appendFileSync,
  mkdirSync, existsSync, readdirSync, statSync,
} from "node:fs"
import { join, extname } from "node:path"
import { createInterface } from "node:readline"
import { spawnSync } from "node:child_process"
import type { ParsedArgs } from "../args"
import { flag, boolFlag } from "../args"
import { createClient } from "../client"
import { printError } from "../output"

// ─── Types ────────────────────────────────────────────────────────────────────

export type InitGlobals = {
  serviceUrl?: string
  adminSecret?: string
  databaseUrl?: string
  jsonMode: boolean
}

type SharedFile = { path: string; content: string }

type MemoryPlan = {
  product: string
  planMarkdown: string
  sharedFiles: SharedFile[]
}

// ─── Help ─────────────────────────────────────────────────────────────────────

const HELP = `
Usage: memex-admin init [options]

One-command setup for MemexAI. Runs in four phases:
  1. Introspect  — reads your codebase, proposes a memory plan (no infra needed)
  2. Docker      — writes compose.yml if missing, starts service, waits for health
  3. Bootstrap   — writes shared/ memory files to service, updates .env
  4. Finish      — writes MEMEX.md, prints code snippets and inspect commands

Options:
  --service-url, -s <url>    MemexAI service URL (default: http://localhost:8080)
  --admin-secret <secret>    Admin secret (default: dev-admin-secret)
  --yes                      Skip interactive confirmations (for non-interactive agents)
  --skip-docker              Skip Docker compose steps (use when service is already running)
  --compose-file <path>      Write compose.yml to this path (default: ./compose.yml)

Examples:
  npx @memexai/admin init
  npx @memexai/admin init --yes --service-url http://localhost:8080
  docker exec memexai memex-admin init --yes --service-url http://localhost:8080
`

// ─── Compose content ──────────────────────────────────────────────────────────

const COMPOSE_YML = `services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: memexai
      POSTGRES_PASSWORD: memexai
      POSTGRES_DB: memexai
    volumes:
      - memexai_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U memexai"]
      interval: 5s
      timeout: 5s
      retries: 5

  memexai:
    image: soorajshankar/memexai:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://memexai:memexai@postgres:5432/memexai
      MEMEX_API_KEY: \${MEMEX_API_KEY:-dev-agent-key}
      MEMEX_ADMIN_SECRET: \${MEMEX_ADMIN_SECRET:-dev-admin-secret}
      GEMINI_API_KEY: \${GEMINI_API_KEY:-}
    ports:
      - "8080:8080"

volumes:
  memexai_postgres_data:
`

// ─── Default shared file content ──────────────────────────────────────────────

const DEFAULT_PROCEDURAL = `# Agent Behavior Rules

## Memory write policy
- Use memory_remember to capture durable facts from user statements.
- Use memory_patch for small updates; prefer it over full rewrites.
- Never write one-off lookups (prices, hours, schedules) or raw conversation text.
- Never write personal health, financial, or legal inferences without confirmation.

## Tool selection
- Call memory_context before any personalized recommendation.
- Call memory_patch for field updates; memory_write only when creating or replacing a file.
- Call memory_remember whenever the user states a preference, constraint, or decision.

## HITL signal
Whenever a clarifying question is answered, capture it in user/preferences.md (stable fact)
or user/log.md (decision/event).

## What NOT to memorize
- Transient statements ("I'm tired today")
- Questions the user is exploring, not deciding
- Anything the user asks to keep private
- One-off lookups (prices, schedules, current availability)
`

const DEFAULT_SEMANTIC = `# Semantic Memory Schema

Semantic memory holds stable, deduplicated facts about a user.

## What belongs in user/preferences.md
- Stated preferences (soft, refinable — patch when updated)
- Hard constraints (non-negotiable blockers)
- Active goals with a time horizon

Format: \`- Fact description [YYYY-MM]\`
When patching, update the timestamp and remove the old line.

## What NOT to store
- One-off lookups, raw conversation text, transient questions
- Anything the user explicitly asked to forget
`

const DEFAULT_EPISODIC = `# Episodic Memory Schema

Episodic memory holds time-ordered events worth carrying forward.

## What belongs in user/log.md
- Options viewed and rejected (include the reason)
- Decisions made (accepted, rejected, changed mind)
- Goal milestones reached
- HITL clarifications resolved (these are durable decisions)

Format: \`- [YYYY-MM] Event — reason if applicable\`

## Append-only
Never patch or edit user/log.md. Only append new lines.

## HITL signal
Log the resolved context when a clarifying question represents a meaningful decision.
`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function section(title: string) {
  process.stdout.write(`\n─── ${title} ${"─".repeat(Math.max(0, 60 - title.length - 5))}\n\n`)
}

function step(msg: string) {
  process.stdout.write(`  ${msg}\n`)
}

function ok(msg: string) {
  process.stdout.write(`✓ ${msg}\n`)
}

function warn(msg: string) {
  process.stdout.write(`⚠ ${msg}\n`)
}

function next(cmd: string) {
  process.stdout.write(`\n→ Next:\n  ${cmd}\n`)
}

async function probeHealth(serviceUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${serviceUrl}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

async function waitForHealth(serviceUrl: string, timeoutMs = 60000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  process.stdout.write("  Waiting for service")
  while (Date.now() < deadline) {
    if (await probeHealth(serviceUrl)) {
      process.stdout.write(" ✓\n")
      return true
    }
    process.stdout.write(".")
    await new Promise((r) => setTimeout(r, 2000))
  }
  process.stdout.write(" ✗\n")
  return false
}

async function askConfirm(question: string): Promise<string> {
  if (!process.stdin.isTTY) return "yes"
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

// ─── Phase 1: Introspect ──────────────────────────────────────────────────────

function collectCodebaseText(cwd: string): string {
  const chunks: string[] = []
  let totalChars = 0
  const MAX_CHARS = 8000

  function tryRead(relPath: string) {
    if (totalChars >= MAX_CHARS) return
    const abs = join(cwd, relPath)
    if (!existsSync(abs)) return
    try {
      const stat = statSync(abs)
      if (!stat.isFile()) return
      const text = readFileSync(abs, "utf8").slice(0, 2000)
      chunks.push(`\n--- ${relPath} ---\n${text}`)
      totalChars += text.length
    } catch { /* skip */ }
  }

  function scanDir(dir: string, depth: number) {
    if (depth > 3 || totalChars >= MAX_CHARS) return
    let entries: string[] = []
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules" || entry === "dist" || entry === ".next") continue
      const abs = join(dir, entry)
      try {
        const stat = statSync(abs)
        if (stat.isDirectory()) {
          scanDir(abs, depth + 1)
        } else if ([".ts", ".tsx", ".py", ".js", ".md"].includes(extname(entry))) {
          const rel = abs.replace(cwd + "/", "")
          if (
            rel.includes("system") || rel.includes("prompt") || rel.includes("agent") ||
            rel.includes("memory") || rel.includes("ai/") || rel.includes("llm") ||
            entry === "README.md" || entry === "package.json"
          ) {
            tryRead(rel)
          }
        }
      } catch { /* skip */ }
    }
  }

  tryRead("README.md")
  tryRead("package.json")
  tryRead("CLAUDE.md")
  scanDir(cwd, 0)
  return chunks.join("\n")
}

const INTROSPECT_PROMPT = `You are analysing a codebase to propose a MemexAI memory plan.

MemexAI stores agent memory as scoped files in Postgres:
  user/   → private per-user facts and events (agents read+write)
  shared/ → global agent guidance and schemas (agents read-only by default)

Output ONLY the following sections, delimited exactly as shown. Do not add other text.

===PLAN===
Product: [one-line description of what this agent/app does]
Inferred from: [list files you read]

USER MEMORY FILES
  File: user/preferences.md
  Captures: [what stable facts belong here — specific to this product]
  Update: patch
  Confidence: HIGH|MEDIUM|LOW
  Reason: [one sentence from the codebase]

  [add more user/ files only if clearly needed — prefer fewer files]

SHARED MEMORY FILES
  File: shared/procedural.md
  Purpose: Agent behavior rules — tool policy, what not to store
  Access: read-only

  File: shared/semantic.md
  Purpose: Schema for facts written to user/preferences.md
  Access: read-only

  File: shared/episodic.md
  Purpose: Schema for events appended to user/log.md
  Access: read-only

  [add shared/[domain].md only if strong domain-specific guidance is needed]

SHARED WRITE MODE
  Recommendation: disabled|enabled
  Reason: [one sentence]

WHAT NOT TO MEMORIZE
  - [bullets — product-specific things agents might wrongly store]

OPEN QUESTIONS FOR DEVELOPER
  - [uncertainties that need human confirmation]

===FILE: shared/procedural.md===
[actual markdown content for this file, specific to this product's agent behavior]

===FILE: shared/semantic.md===
[actual markdown content for this file, with product-specific fact categories]

===FILE: shared/episodic.md===
[actual markdown content for this file, with product-specific event types]

Codebase:
`

async function callGemini(apiKey: string, codebaseText: string): Promise<string> {
  const prompt = INTROSPECT_PROMPT + codebaseText
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(30000),
    },
  )
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text().catch(() => "")}`)
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}

async function callOpenAI(apiKey: string, codebaseText: string): Promise<string> {
  const prompt = INTROSPECT_PROMPT + codebaseText
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text().catch(() => "")}`)
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ""
}

function parseLlmOutput(text: string, codebaseText: string): MemoryPlan {
  const sections = text.split(/^===(.*?)===$/m)
  const planSection = sections.find((_, i) => sections[i - 1]?.trim() === "PLAN") ?? ""
  const fileEntries: SharedFile[] = []

  for (let i = 0; i < sections.length; i++) {
    const header = sections[i]?.trim()
    if (header?.startsWith("FILE: ")) {
      const path = header.slice(6).trim()
      const content = sections[i + 1]?.trim() ?? ""
      if (path && content) fileEntries.push({ path, content })
    }
  }

  const productLine = planSection.match(/^Product:\s*(.+)$/m)
  const product = productLine?.[1]?.trim() ?? "AI agent"

  if (fileEntries.length === 0) {
    return buildStaticPlan(product, codebaseText)
  }

  return {
    product,
    planMarkdown: buildPlanMarkdown(product, planSection, fileEntries),
    sharedFiles: fileEntries,
  }
}

function buildStaticPlan(product: string, _codebaseText: string): MemoryPlan {
  const sharedFiles: SharedFile[] = [
    { path: "shared/procedural.md", content: DEFAULT_PROCEDURAL },
    { path: "shared/semantic.md", content: DEFAULT_SEMANTIC },
    { path: "shared/episodic.md", content: DEFAULT_EPISODIC },
  ]
  return {
    product,
    planMarkdown: buildPlanMarkdown(product, "(static default — no LLM key configured)", sharedFiles),
    sharedFiles,
  }
}

function buildPlanMarkdown(product: string, planText: string, sharedFiles: SharedFile[]): string {
  const fileList = sharedFiles.map((f) => `  - ${f.path}`).join("\n")
  return `# MemexAI Memory Plan
Generated: ${new Date().toISOString().slice(0, 10)}
Product: ${product}

${planText.trim()}

## Shared files to be written
${fileList}

## How to customize
Edit .memexai/shared/*.md files before running \`memex-admin init\` again.
Changes to .memexai/shared/ can be pushed at any time with:
  memex-admin shared push --from ./.memexai/shared/
`
}

async function runIntrospection(cwd: string, yes: boolean): Promise<MemoryPlan> {
  section("Phase 1 · Introspect")
  step("Reading codebase files...")
  const codebaseText = collectCodebaseText(cwd)

  const geminiKey = process.env["GEMINI_API_KEY"]
  const openaiKey = process.env["OPENAI_API_KEY"]

  let plan: MemoryPlan
  if (geminiKey) {
    step("Calling Gemini to generate memory plan...")
    try {
      const raw = await callGemini(geminiKey, codebaseText)
      plan = parseLlmOutput(raw, codebaseText)
      ok("Memory plan generated with Gemini")
    } catch (e) {
      warn(`Gemini call failed (${(e as Error).message}) — using static template`)
      plan = buildStaticPlan("AI agent", codebaseText)
    }
  } else if (openaiKey) {
    step("Calling OpenAI to generate memory plan...")
    try {
      const raw = await callOpenAI(openaiKey, codebaseText)
      plan = parseLlmOutput(raw, codebaseText)
      ok("Memory plan generated with OpenAI")
    } catch (e) {
      warn(`OpenAI call failed (${(e as Error).message}) — using static template`)
      plan = buildStaticPlan("AI agent", codebaseText)
    }
  } else {
    warn("No LLM key found (GEMINI_API_KEY / OPENAI_API_KEY) — using static template")
    plan = buildStaticPlan("AI agent", codebaseText)
  }

  mkdirSync(join(cwd, ".memexai", "shared"), { recursive: true })
  writeFileSync(join(cwd, ".memexai", "plan.md"), plan.planMarkdown)
  for (const f of plan.sharedFiles) {
    writeFileSync(join(cwd, ".memexai", f.path.replace("shared/", "shared/")), f.content)
  }
  ok(`Written .memexai/plan.md and ${plan.sharedFiles.length} shared file(s)`)

  process.stdout.write("\n")
  process.stdout.write(plan.planMarkdown)
  process.stdout.write("\n")

  if (!yes) {
    const answer = await askConfirm(
      '\nDoes this memory plan look right?\n  "yes" to proceed · "no" to exit and edit .memexai/plan.md · "updated" to re-read after editing\n\n> ',
    )
    if (answer === "no" || answer === "n") {
      process.stdout.write("\nEdit .memexai/plan.md and .memexai/shared/*.md, then re-run: memex-admin init\n")
      process.exit(0)
    }
    if (answer === "updated") {
      process.stdout.write("Re-reading .memexai/plan.md...\n")
      const updatedPlan = readFileSync(join(cwd, ".memexai", "plan.md"), "utf8")
      plan.planMarkdown = updatedPlan
    }
  }

  return plan
}

// ─── Phase 2: Docker ──────────────────────────────────────────────────────────

type ComposeState = "none" | "exists-no-memexai" | "exists-with-memexai"

function detectComposeState(composePath: string): ComposeState {
  if (!existsSync(composePath)) return "none"
  const content = readFileSync(composePath, "utf8")
  if (content.includes("soorajshankar/memexai") || content.includes("image: memexai")) {
    return "exists-with-memexai"
  }
  return "exists-no-memexai"
}

function printMergeInstructions(adminSecret: string, serviceUrl: string) {
  process.stdout.write(`
A compose.yml already exists. Add these services to it:

  memexai:
    image: soorajshankar/memexai:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://memexai:memexai@postgres:5432/memexai
      MEMEX_API_KEY: \${MEMEX_API_KEY:-dev-agent-key}
      MEMEX_ADMIN_SECRET: \${MEMEX_ADMIN_SECRET:-dev-admin-secret}
      GEMINI_API_KEY: \${GEMINI_API_KEY:-}
    ports:
      - "8080:8080"

You also need a postgres service if not already present.
After merging, run:
`)
  next(`docker compose up -d\n  curl ${serviceUrl}/health\n  npx @memexai/admin init --service-url ${serviceUrl} --admin-secret ${adminSecret}`)
  process.exit(0)
}

async function ensureService(opts: {
  cwd: string
  serviceUrl: string
  adminSecret: string
  composePath: string
  skipDocker: boolean
}): Promise<void> {
  section("Phase 2 · Infrastructure")

  const healthy = await probeHealth(opts.serviceUrl)
  if (healthy) {
    ok(`Service already running at ${opts.serviceUrl}`)
    return
  }

  if (opts.skipDocker) {
    printError(`Service not reachable at ${opts.serviceUrl} and --skip-docker was set`)
    next(`Start your service manually, then re-run: memex-admin init --service-url ${opts.serviceUrl}`)
    process.exit(1)
  }

  const state = detectComposeState(opts.composePath)

  if (state === "none") {
    writeFileSync(opts.composePath, COMPOSE_YML)
    ok(`Written ${opts.composePath}`)
  } else if (state === "exists-no-memexai") {
    printMergeInstructions(opts.adminSecret, opts.serviceUrl)
    return
  } else {
    step("Found existing compose.yml with memexai service")
  }

  step("Starting Docker services...")
  const result = spawnSync("docker", ["compose", "-f", opts.composePath, "up", "-d"], {
    stdio: "inherit",
    cwd: opts.cwd,
  })
  if (result.status !== 0) {
    printError("docker compose up -d failed")
    next(`docker compose logs memexai\n  # fix any errors, then re-run: memex-admin init`)
    process.exit(1)
  }

  const ok2 = await waitForHealth(opts.serviceUrl, 60000)
  if (!ok2) {
    printError(`Service did not become healthy within 60s at ${opts.serviceUrl}`)
    step(`Run: docker compose logs memexai`)
    next(`After fixing, re-run: memex-admin init --service-url ${opts.serviceUrl}`)
    process.exit(1)
  }
  ok(`Service healthy at ${opts.serviceUrl}`)
}

// ─── Phase 3: Bootstrap ───────────────────────────────────────────────────────

async function bootstrapSharedMemory(opts: {
  cwd: string
  serviceUrl: string
  adminSecret: string
  plan: MemoryPlan
}): Promise<void> {
  section("Phase 3 · Bootstrap shared memory")

  const client = await createClient({
    serviceUrl: opts.serviceUrl,
    adminSecret: opts.adminSecret,
    skipMigrations: true,
  }).catch((e: Error) => {
    printError(e.message)
    process.exit(1)
  })

  try {
    const statusRaw = await client.getSetupStatus() as { bootstrapped?: boolean }
    if (statusRaw.bootstrapped) {
      ok("Already bootstrapped — skipping shared file writes")
      await client.close()
      return
    }

    const sharedDir = join(opts.cwd, ".memexai", "shared")
    const filesToWrite = opts.plan.sharedFiles

    for (const f of filesToWrite) {
      await client.writeFile(f.path, f.content, "bootstrap")
      ok(`Written ${f.path} to service`)
    }

    await client.writeSetupComplete(opts.plan.product)
    ok(`Setup marked complete — "${opts.plan.product}"`)

    appendDotEnv(opts.cwd, opts.serviceUrl)
    ok("Appended MEMEX_* vars to .env")
  } finally {
    await client.close()
  }

  step("")
  step(`Admin UI: ${opts.serviceUrl}/admin`)
  step(`Admin secret: ${opts.adminSecret}`)
  step(`Agent API key: dev-agent-key`)
}

function appendDotEnv(cwd: string, serviceUrl: string) {
  const envPath = join(cwd, ".env")
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : ""

  const vars: Record<string, string> = {
    MEMEX_URL: serviceUrl,
    MEMEX_API_KEY: "dev-agent-key",
    MEMEX_ADMIN_SECRET: "dev-admin-secret",
  }

  const toAppend = Object.entries(vars)
    .filter(([k]) => !existing.includes(`${k}=`))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  if (toAppend) {
    appendFileSync(envPath, `\n# MemexAI\n${toAppend}\n`)
  }
}

// ─── Phase 4: Finish ──────────────────────────────────────────────────────────

function writeMemexMd(cwd: string, plan: MemoryPlan, serviceUrl: string, adminSecret: string) {
  const fileTable = plan.sharedFiles
    .map((f) => `| \`${f.path}\` | shared schema/rules | admin or CI/CD |`)
    .join("\n")

  const content = `# MemexAI Memory Setup

Product: ${plan.product}
Setup: ${new Date().toISOString().slice(0, 10)}
Service: ${serviceUrl}

## Memory files

| File | Purpose | Who manages it |
|------|---------|----------------|
| \`user/preferences.md\` | Per-user stable facts | Agents (write) |
| \`user/log.md\` | Per-user events (append-only) | Agents (write) |
${fileTable}

## Local files (committed to repo)

\`.memexai/plan.md\` — memory plan and rationale
\`.memexai/shared/\` — source of truth for shared/ files

## Sync shared memory

\`\`\`bash
# Push local shared files to service (use in CI/CD)
memex-admin -s ${serviceUrl} --admin-secret ${adminSecret} \\
  shared push --from ./.memexai/shared/

# Pull current shared files from service (to review agent changes)
memex-admin -s ${serviceUrl} --admin-secret ${adminSecret} \\
  shared pull --out ./.memexai/shared/
\`\`\`

## Debug commands

\`\`\`bash
# Inspect shared files
memex-admin -s ${serviceUrl} --admin-secret ${adminSecret} files list --prefix shared/

# What a user's agent wrote (replace USERID)
memex-admin -s ${serviceUrl} --admin-secret ${adminSecret} files list --prefix users/USERID/
memex-admin -s ${serviceUrl} --admin-secret ${adminSecret} files get users/USERID/preferences.md

# Access log for a session
memex-admin -s ${serviceUrl} --admin-secret ${adminSecret} logs list --user USERID --limit 20

# Trace a tool call
memex-admin -s ${serviceUrl} --admin-secret ${adminSecret} trace TOOL_CALL_ID
\`\`\`
`
  writeFileSync(join(cwd, "MEMEX.md"), content)
}

function printFinish(serviceUrl: string, adminSecret: string) {
  section("Done")

  process.stdout.write(`✓ MemexAI is ready.\n\n`)

  process.stdout.write(`─── Use in your code ─────────────────────────────────────────────────────────\n\n`)
  process.stdout.write(`TypeScript (Vercel AI SDK):\n\n`)
  process.stdout.write(`  import { MemexAI } from "@memexai/sdk"\n`)
  process.stdout.write(`  import { generateText, stepCountIs } from "ai"\n\n`)
  process.stdout.write(`  const memex = new MemexAI({ url: process.env.MEMEX_URL, apiKey: process.env.MEMEX_API_KEY })\n`)
  process.stdout.write(`  const memory = memex.forUser({ userId: "user_123", actor: "assistant" })\n`)
  process.stdout.write(`  const system = await memory.getSystemPrompt("You are a helpful assistant.")\n\n`)
  process.stdout.write(`  const result = await generateText({\n`)
  process.stdout.write(`    model: yourModel,\n`)
  process.stdout.write(`    system,\n`)
  process.stdout.write(`    prompt: userInput,\n`)
  process.stdout.write(`    tools: memory.createMemorySubagentToolset(),\n`)
  process.stdout.write(`    stopWhen: stepCountIs(5),\n`)
  process.stdout.write(`  })\n\n`)
  process.stdout.write(`Python:\n\n`)
  process.stdout.write(`  from memexai import MemexAI\n`)
  process.stdout.write(`  memex = MemexAI(url=os.environ["MEMEX_URL"], api_key=os.environ["MEMEX_API_KEY"])\n`)
  process.stdout.write(`  memory = memex.for_user("user_123", actor="assistant")\n\n`)

  process.stdout.write(`─── Inspect and debug ────────────────────────────────────────────────────────\n\n`)
  const s = `memex-admin -s ${serviceUrl} --admin-secret ${adminSecret}`
  process.stdout.write(`  ${s} files list --prefix shared/\n`)
  process.stdout.write(`  ${s} files get shared/procedural.md\n`)
  process.stdout.write(`  ${s} files list --prefix users/USERID/\n`)
  process.stdout.write(`  ${s} files get users/USERID/preferences.md\n`)
  process.stdout.write(`  ${s} logs list --user USERID --limit 20\n`)
  process.stdout.write(`  ${s} trace TOOL_CALL_ID\n\n`)

  process.stdout.write(`─── Shared memory CI/CD ──────────────────────────────────────────────────────\n\n`)
  process.stdout.write(`  # Push .memexai/shared/ to service on deploy:\n`)
  process.stdout.write(`  ${s} shared push --from ./.memexai/shared/\n\n`)

  process.stdout.write(`Admin UI: ${serviceUrl}/admin\n`)
  process.stdout.write(`Commit:   .memexai/   MEMEX.md   .env (gitignore secrets!)\n`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function initCommand(args: ParsedArgs, globals: InitGlobals): Promise<void> {
  if (boolFlag(args.flags, "help", "h")) {
    process.stdout.write(HELP)
    return
  }

  const cwd = process.cwd()
  const serviceUrl = flag(args.flags, "service-url", "s") ?? globals.serviceUrl ?? "http://localhost:8080"
  const adminSecret = flag(args.flags, "admin-secret") ?? globals.adminSecret ?? "dev-admin-secret"
  const yes = boolFlag(args.flags, "yes")
  const skipDocker = boolFlag(args.flags, "skip-docker")
  const composePath = flag(args.flags, "compose-file") ?? join(cwd, "compose.yml")

  process.stdout.write(`\nMemexAI init — ${serviceUrl}\n`)

  // Check if already fully set up
  const alreadyHealthy = await probeHealth(serviceUrl)
  if (alreadyHealthy) {
    const client = await createClient({ serviceUrl, adminSecret, skipMigrations: true }).catch(() => null)
    if (client) {
      const status = await client.getSetupStatus().catch(() => null) as { bootstrapped?: boolean } | null
      await client.close().catch(() => {})
      if (status?.bootstrapped) {
        ok(`Already bootstrapped at ${serviceUrl}`)
        process.stdout.write(`\nInspect:\n`)
        const s = `memex-admin -s ${serviceUrl} --admin-secret ${adminSecret}`
        process.stdout.write(`  ${s} files list --prefix shared/\n`)
        process.stdout.write(`  ${s} setup status\n`)
        process.stdout.write(`  ${s} files list --prefix users/USERID/\n`)
        return
      }
    }
  }

  // Phase 1: introspect (always runs if not already bootstrapped)
  const planExists = existsSync(join(cwd, ".memexai", "plan.md"))
  let plan: MemoryPlan

  if (planExists && yes) {
    // Re-use existing plan when --yes and plan already written
    const planMd = readFileSync(join(cwd, ".memexai", "plan.md"), "utf8")
    const productMatch = planMd.match(/^Product:\s*(.+)$/m)
    const sharedDir = join(cwd, ".memexai", "shared")
    const sharedFiles: SharedFile[] = []
    if (existsSync(sharedDir)) {
      for (const f of readdirSync(sharedDir)) {
        const p = join(sharedDir, f)
        if (statSync(p).isFile()) {
          sharedFiles.push({ path: `shared/${f}`, content: readFileSync(p, "utf8") })
        }
      }
    }
    plan = {
      product: productMatch?.[1]?.trim() ?? "AI agent",
      planMarkdown: planMd,
      sharedFiles: sharedFiles.length > 0 ? sharedFiles : [
        { path: "shared/procedural.md", content: DEFAULT_PROCEDURAL },
        { path: "shared/semantic.md", content: DEFAULT_SEMANTIC },
        { path: "shared/episodic.md", content: DEFAULT_EPISODIC },
      ],
    }
    ok("Re-using existing .memexai/plan.md")
  } else {
    plan = await runIntrospection(cwd, yes)
  }

  // Phase 2: Docker
  await ensureService({ cwd, serviceUrl, adminSecret, composePath, skipDocker })

  // Phase 3: Bootstrap
  await bootstrapSharedMemory({ cwd, serviceUrl, adminSecret, plan })

  // Phase 4: Finish
  writeMemexMd(cwd, plan, serviceUrl, adminSecret)
  ok("Written MEMEX.md")

  printFinish(serviceUrl, adminSecret)
}
