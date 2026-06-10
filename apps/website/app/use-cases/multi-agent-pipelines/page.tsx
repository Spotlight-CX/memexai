import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Multi-agent pipeline memory — MemexAI',
  description:
    'How multi-agent products use MemexAI shared memory to coordinate behavioral policies across agents without redeploying prompts — update once, all agents reflect it.',
  alternates: { canonical: '/use-cases/multi-agent-pipelines' },
  openGraph: {
    title: 'Multi-agent pipeline memory — MemexAI',
    description:
      'One shared memory layer that all agents read. Update a coordination policy once — every agent in your deployment reflects it on the next call.',
    url: 'https://memexai.space/use-cases/multi-agent-pipelines',
  },
}

export default function MultiAgentPipelinesPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Multi-agent pipelines</div>
          <h1>One policy update. All agents reflect it.</h1>
          <p className="section-lede">
            When coordination rules live in prompts, changing policy means updating every agent and redeploying.
            MemexAI's shared memory layer gives all agents in your product a common source of truth — updated once,
            read by everyone, no redeploy needed.
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
        <h2>Coordination that lives in prompts doesn't scale.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              A real product pipeline isn't one agent. It's an orchestrator, a researcher, a writer, a reviewer —
              specialists that hand work between them. Each has its own system prompt. Each embeds the same coordination
              rules: escalation criteria, rate limits, tool usage policies, shared vocabulary.
            </p>
            <p style={{ marginTop: 14 }}>
              When a policy changes — new API rate limit, updated escalation threshold, revised tool constraints —
              you update every prompt, coordinate a deploy, and hope nothing drifts. In practice, prompts fall out of
              sync. The orchestrator and the reviewer have different understandings of what "escalate" means.
            </p>
          </div>
          <div className="path-panel">
            <p>
              The per-user memory problem is separate: each user's private context (preferences, history, state) needs
              to follow the user across whichever agent is currently handling them. If that context lives in the
              orchestrator, specialist agents don't see it. If you copy it into each agent's prompt, you create
              duplication and inconsistency.
            </p>
            <p style={{ marginTop: 14 }}>
              What you need is a layer that separates global coordination policy (same for all agents, all users) from
              per-user state (private to one user, available to any agent serving them) — and that updates both without
              a deployment.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Two namespaces. One memory layer.</h2>
        <div className="split">
          <div className="path-panel">
            <h3>
              <code>shared/</code> — global policy
            </h3>
            <p>
              Files under <code>shared/</code> are loaded into every agent's prompt block, read-only. Escalation rules,
              tool constraints, rate limits, coordination conventions — all in one place. Update a shared file and every
              agent's next call reflects the change.
            </p>
            <pre>{`# shared/policies.md
## Escalation
Route to human if: user explicitly requests, or confidence < 0.7.
Never escalate for technical errors — retry once first.

## Rate limits
search_properties: 100 req/min — batch when possible
document_analysis: 10 concurrent max

## Handoff protocol
When passing to specialist: include task_id, user_id,
and a one-line context summary. Never forward raw history.`}</pre>
          </div>
          <div className="path-panel">
            <h3>
              <code>user/</code> — per-user context
            </h3>
            <p>
              Per-user state is physically isolated under <code>users/{'{userId}'}/**</code>. Any agent handling this
              user calls <code>{'getPromptBlock({ userId })'}</code> and gets their current context — preferences, history,
              task state — automatically. No orchestrator needs to forward it.
            </p>
            <p style={{ marginTop: 14 }}>
              This means specialist agents don't need to know about each other. The researcher writes what it learned.
              The reviewer picks up that context next call. The memory layer is the coordination substrate — not the
              orchestrator's prompt.
            </p>
            <p style={{ marginTop: 14 }}>
              Agents never cross tenant boundaries. Physical path isolation means the researcher working on user A's
              task cannot read user B's memory, even if both run in the same process.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Coordination that's operationally maintainable.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Shared policies update once and propagate to all agents — no redeploy.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Per-user context follows the user across every agent in the pipeline.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Physical tenant isolation — agents can't cross user boundaries, even accidentally.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Admin console lets your team inspect and correct shared policies and user state.</span>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Docs</div>
        <h2>Go deeper.</h2>
        <div className="uc-links">
          <Link href="/docs/concepts/shared-memory" className="uc-link">
            Shared memory <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/operations/trust-model" className="uc-link">
            Trust model <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/prompt-block" className="uc-link">
            Prompt block <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/scopes" className="uc-link">
            Scopes and isolation <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
