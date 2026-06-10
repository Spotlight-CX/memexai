import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Long-horizon agent memory — MemexAI',
  description:
    'How long-running AI agents use MemexAI to persist task state, completed sub-goals, and learned constraints across context window resets — so they continue rather than restart.',
  alternates: { canonical: '/use-cases/long-horizon-agents' },
  openGraph: {
    title: 'Long-horizon agent memory — MemexAI',
    description:
      'Task checkpoints and learned constraints that survive context resets. Continue where you left off, every time.',
    url: 'https://memexai.space/use-cases/long-horizon-agents',
  },
}

export default function LongHorizonAgentsPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Long-horizon agents</div>
          <h1>Continue where you left off. Every time.</h1>
          <p className="section-lede">
            Complex tasks don't fit in one context window. MemexAI gives long-running agents a checkpoint layer —
            completed steps, open questions, and hard-won constraints that survive resets and carry forward on resumption.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/quickstart/docker-service">
              Start with Docker
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/use-cases">
              <ArrowLeft size={15} aria-hidden />
              All use cases
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">The problem</div>
        <h2>Context resets are silent progress destroyers.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              Research pipelines, legal document analysis, multi-step code audits — tasks that take hours or days can't
              complete in a single context window. The agent hits the limit, the context resets, and the next run starts
              from scratch.
            </p>
            <p style={{ marginTop: 14 }}>
              This isn't just inefficient. It actively causes regressions. The agent re-runs steps it already completed.
              It tries API calls it already learned fail with a specific error. It makes architectural decisions that
              contradict conclusions from earlier in the task.
            </p>
          </div>
          <div className="path-panel">
            <p>
              The most expensive part of a long-horizon task is the discovery work — understanding what's in the
              codebase, learning how a specific API behaves, figuring out which approach doesn't work. When that
              knowledge doesn't persist, you pay the discovery cost on every run.
            </p>
            <p style={{ marginTop: 14 }}>
              Some teams work around this by manually injecting state into prompts, or by writing custom "resume from
              step N" logic. That's brittle, hard to maintain, and specific to one task shape. It doesn't generalize.
            </p>
            <p style={{ marginTop: 14 }}>
              What you actually need is a memory layer the agent writes to as it works, and that gets loaded before the
              first tool call on resumption — without custom glue code per task.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Write checkpoints as you work. Load them on resumption.</h2>
        <div className="split">
          <div className="path-panel">
            <h3>During execution</h3>
            <p>
              As the agent completes steps and discovers constraints, it writes to task memory. Completed sub-goals,
              open questions, dead ends, learned API behaviors — structured into files the agent can read back quickly
              on next run.
            </p>
            <pre>{`// Agent writes a checkpoint mid-task
await memory_write({
  path: "user/task-audit/progress.md",
  content: \`## Completed
- Scanned 847 routes — no auth middleware on /api/admin/*
- Confirmed rate limit: 100 req/min on /search endpoint

## Open
- Need to check /webhooks handler for input validation
- Dependency audit incomplete (stopped at line 2300)

## Learned constraints
- pg-core version mismatch breaks migration runner\`
})`}</pre>
          </div>
          <div className="path-panel">
            <h3>On resumption</h3>
            <p>
              <code>getPromptBlock</code> injects the current task state before the first tool call. The agent reads the
              progress file, picks up at the right step, and continues without re-discovering what it already knows.
            </p>
            <p style={{ marginTop: 14 }}>
              Background dreaming runs between sessions to compact and organize task memory — merging fragmented notes,
              removing completed items, restructuring the task file as understanding deepens. The agent returns to a
              clean, current state rather than an accumulation of session noise.
            </p>
            <p style={{ marginTop: 14 }}>
              Revision history means the full evolution of the task state is preserved. You can trace when a specific
              constraint was discovered, see what the agent knew at each checkpoint, and roll back if dreaming compacted
              something important.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Discovery cost paid once. Progress that compounds.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Task checkpoints survive context resets — the agent continues, not restarts.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Learned constraints (rate limits, API quirks, dead ends) persist across sessions.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Background dreaming keeps task memory clean as the task evolves.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Full revision history — see exactly what the agent knew at each checkpoint.</span>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Docs</div>
        <h2>Go deeper.</h2>
        <div className="uc-links">
          <Link href="/docs/concepts/cognitive-architecture" className="uc-link">
            Cognitive architecture <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/memory-tools" className="uc-link">
            Memory tools <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/operations/dreaming" className="uc-link">
            Background Dreaming <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/design-principles" className="uc-link">
            Design principles <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
