import type { ParsedArgs } from "../args"

// ─── Topic registry ───────────────────────────────────────────────────────────

const BASE = "https://memexai.space"
const DOCS_BASE = `${BASE}/llms.mdx/docs`

type Topic = {
  description: string
  url: string
}

const TOPICS: Record<string, Topic> = {
  setup: {
    description: "Full coding-agent setup guide (3 paths: npx, docker exec, curl)",
    url: `${BASE}/setup.md`,
  },
  quickstart: {
    description: "Fastest path to working memory (same as quickstart/agent-onboarding)",
    url: `${DOCS_BASE}/quickstart/agent-onboarding/content.md`,
  },
  "quickstart/agent-onboarding": {
    description: "Coding agent setup — npx init, docker exec, curl",
    url: `${DOCS_BASE}/quickstart/agent-onboarding/content.md`,
  },
  "quickstart/docker-service": {
    description: "Run the containerized service with Docker Compose",
    url: `${DOCS_BASE}/quickstart/docker-service/content.md`,
  },
  "quickstart/direct-postgres": {
    description: "Direct Postgres mode — skip the HTTP service",
    url: `${DOCS_BASE}/quickstart/direct-postgres/content.md`,
  },
  sdk: {
    description: "TypeScript SDK (same as sdk/typescript)",
    url: `${DOCS_BASE}/sdks/typescript/content.md`,
  },
  "sdk/typescript": {
    description: "TypeScript SDK — Vercel AI, OpenAI, Anthropic, LangChain adapters",
    url: `${DOCS_BASE}/sdks/typescript/content.md`,
  },
  "sdk/python": {
    description: "Python SDK and framework adapters",
    url: `${DOCS_BASE}/sdks/python/content.md`,
  },
  "concepts/memory-tools": {
    description: "The four agent tools: memory_list, memory_read, memory_write, memory_patch",
    url: `${DOCS_BASE}/concepts/memory-tools/content.md`,
  },
  "concepts/shared-memory": {
    description: "shared/ files — global agent guidance, read-only by default",
    url: `${DOCS_BASE}/concepts/shared-memory/content.md`,
  },
  "concepts/scopes": {
    description: "Virtual path scopes: user/ and shared/, and how they translate to physical paths",
    url: `${DOCS_BASE}/concepts/scopes/content.md`,
  },
  "concepts/cognitive-architecture": {
    description: "Procedural / semantic / episodic memory layers",
    url: `${DOCS_BASE}/concepts/cognitive-architecture/content.md`,
  },
  "concepts/how-it-works": {
    description: "End-to-end flow: tool call → path validation → SQL → prompt block",
    url: `${DOCS_BASE}/concepts/how-it-works/content.md`,
  },
  "concepts/prompt-block": {
    description: "What getSystemPrompt() injects and why it matters",
    url: `${DOCS_BASE}/concepts/prompt-block/content.md`,
  },
  "concepts/revisions": {
    description: "Revision history — every write creates a full content snapshot",
    url: `${DOCS_BASE}/concepts/revisions/content.md`,
  },
  "concepts/access-logs": {
    description: "Access log — lightweight read/write trace for every tool call",
    url: `${DOCS_BASE}/concepts/access-logs/content.md`,
  },
  architecture: {
    description: "Two deployment modes (HTTP service vs direct Postgres) and data flow",
    url: `${DOCS_BASE}/architecture/content.md`,
  },
  mcp: {
    description: "MCP (Model Context Protocol) server integration",
    url: `${DOCS_BASE}/mcp/content.md`,
  },
  examples: {
    description: "Example repos for each SDK/framework",
    url: "", // handled inline
  },
}

const EXAMPLES: Array<{ name: string; dir: string; description: string }> = [
  { name: "vercel-ai", dir: "examples/vercel-ai", description: "Vercel AI SDK + Gemini, direct Postgres" },
  { name: "vercel-ai-service", dir: "examples/vercel-ai-service", description: "Vercel AI SDK + HTTP service" },
  { name: "openai-sdk-service", dir: "examples/openai-sdk-service", description: "OpenAI SDK + HTTP service" },
  { name: "anthropic", dir: "examples/anthropic", description: "Anthropic SDK, direct Postgres" },
  { name: "anthropic-service", dir: "examples/anthropic-service", description: "Anthropic SDK + HTTP service" },
  { name: "langchain-python", dir: "examples/langchain-python", description: "LangChain Python + HTTP service" },
  { name: "langgraph-python", dir: "examples/langgraph-python", description: "LangGraph Python + HTTP service" },
  { name: "llamaindex-python", dir: "examples/llamaindex-python", description: "LlamaIndex Python + HTTP service" },
  { name: "crewai-python", dir: "examples/crewai-python", description: "CrewAI Python + HTTP service" },
  { name: "google-adk-python", dir: "examples/google-adk-python", description: "Google ADK Python + MemexAdkMemoryService" },
]

// ─── Help ─────────────────────────────────────────────────────────────────────

const HELP = `
Usage: memex-admin docs [topic]

Read MemexAI documentation directly in the terminal. Content is fetched live
from https://memexai.space — no service connection needed.

Topics:
  setup                        Full coding-agent setup guide (3 paths)
  quickstart                   Fastest path to working memory
  quickstart/agent-onboarding  Coding agent onboarding (npx init, docker exec, curl)
  quickstart/docker-service    Docker Compose service setup
  quickstart/direct-postgres   Direct Postgres mode
  sdk                          TypeScript SDK (default)
  sdk/typescript               Vercel AI, OpenAI, Anthropic, LangChain adapters
  sdk/python                   Python SDK and adapters
  concepts/memory-tools        Four agent tools: list, read, write, patch
  concepts/shared-memory       shared/ files and CI/CD sync
  concepts/scopes              Virtual path namespace (user/ and shared/)
  concepts/cognitive-architecture  Procedural / semantic / episodic layers
  concepts/how-it-works        End-to-end tool call → SQL → prompt block flow
  concepts/prompt-block        What getSystemPrompt() injects
  concepts/revisions           Revision history per write
  concepts/access-logs         Read/write trace per tool call
  architecture                 HTTP service vs direct Postgres comparison
  mcp                          MCP server integration
  examples                     Example repos for each framework

Examples:
  memex-admin docs                        # list all topics
  memex-admin docs setup                  # full setup guide
  memex-admin docs sdk/typescript         # TypeScript SDK guide
  memex-admin docs concepts/memory-tools  # memory tool reference
  memex-admin docs examples               # example repos
`

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchDoc(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function docsCommand(
  sub: string | undefined,
  _args: ParsedArgs,
): Promise<void> {
  if (!sub || sub === "--help" || sub === "-h" || sub === "help") {
    process.stdout.write(HELP)
    return
  }

  // List all topics
  if (sub === "list") {
    for (const [key, t] of Object.entries(TOPICS)) {
      process.stdout.write(`  ${key.padEnd(38)} ${t.description}\n`)
    }
    return
  }

  // Examples — inline, no fetch
  if (sub === "examples") {
    process.stdout.write("\nMemexAI example repos:\n\n")
    for (const ex of EXAMPLES) {
      process.stdout.write(`  ${ex.name.padEnd(28)} ${ex.description}\n`)
    }
    process.stdout.write(`\nAll examples live in the memexai repo under examples/\n`)
    process.stdout.write(`Clone: git clone https://github.com/Spotlight-CX/memexai\n`)
    process.stdout.write(`\n→ Next:\n`)
    process.stdout.write(`  memex-admin docs sdk/typescript   # TypeScript adapter reference\n`)
    process.stdout.write(`  memex-admin docs sdk/python       # Python adapter reference\n`)
    return
  }

  const topic = TOPICS[sub]
  if (!topic) {
    process.stderr.write(`Unknown topic: ${sub}\nRun 'memex-admin docs' for a list of topics.\n`)
    process.exit(1)
  }

  process.stdout.write(`Fetching ${topic.url} ...\n\n`)
  const content = await fetchDoc(topic.url)

  if (!content) {
    process.stderr.write(
      `Could not fetch docs for '${sub}'.\n` +
      `Check your internet connection or read online:\n` +
      `  ${topic.url.replace("/llms.mdx/docs/", "/docs/").replace("/content.md", "")}\n\n` +
      `Or run: memex-admin docs --help\n`,
    )
    process.exit(1)
  }

  process.stdout.write(content)
  process.stdout.write("\n")

  // Print a "what to read next" hint based on topic
  const hints: Record<string, string> = {
    setup: "memex-admin docs sdk/typescript",
    quickstart: "memex-admin docs concepts/memory-tools",
    "quickstart/agent-onboarding": "memex-admin docs sdk/typescript",
    "quickstart/docker-service": "memex-admin docs sdk/typescript",
    sdk: "memex-admin docs concepts/shared-memory",
    "sdk/typescript": "memex-admin docs concepts/shared-memory",
    "sdk/python": "memex-admin docs concepts/shared-memory",
    "concepts/memory-tools": "memex-admin docs concepts/shared-memory",
    "concepts/shared-memory": "memex-admin docs concepts/cognitive-architecture",
    "concepts/scopes": "memex-admin docs concepts/memory-tools",
    "concepts/cognitive-architecture": "memex-admin docs sdk/typescript",
  }
  const next = hints[sub]
  if (next) {
    process.stdout.write(`\n→ Next: ${next}\n`)
  }
}
