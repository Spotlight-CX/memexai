import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Sales AI memory — MemexAI',
  description:
    'How sales AI agents use MemexAI to remember prospect context, deal stage, and objection history across every call — and let sales ops correct stale facts before they cost a deal.',
  alternates: { canonical: '/use-cases/sales-ai' },
  openGraph: {
    title: 'Sales AI memory — MemexAI',
    description:
      'Sales AI that carries prospect context across every call. MemexAI gives sales ops a direct line to correct what the agent learned — before it costs a deal.',
    url: 'https://memexai.space/use-cases/sales-ai',
  },
}

export default function SalesAIPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Sales AI</div>
          <h1>Your sales AI should remember the last call. And the one before.</h1>
          <p className="section-lede">
            Deal stage, objection history, stakeholder preferences, budget constraints — context that took three calls
            to build shouldn't reset when the session ends. MemexAI persists it across every interaction and gives your
            sales ops team a direct line to fix what the agent gets wrong.
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
        <h2>A sales agent that forgets is worse than no agent at all.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              Sales context is expensive to build. The prospect's budget cycle, the objections they raised in the second
              call, the champion who went quiet after the legal review — none of this is in the CRM. It's in the rep's
              head, in call notes, scattered across conversations that happened weeks apart.
            </p>
            <p style={{ marginTop: 14 }}>
              A sales AI agent that doesn't carry this context forward repeats questions the prospect already answered.
              It re-surfaces objections that were resolved. It pitches the wrong tier because the deal stage changed
              since the last session. Every miss chips away at trust in a process where trust is the only lever.
            </p>
            <p style={{ marginTop: 14 }}>
              The standard CRM API integration doesn't fix this. CRM holds structured deal data — stage, owner, close
              date. It doesn't hold the nuanced, session-specific context that determines whether this call moves the
              deal forward or stalls it.
            </p>
          </div>
          <div className="path-panel">
            <p>
              The correction problem is just as acute. Sales ops knows when the agent's memory is wrong — wrong
              stakeholder listed, outdated budget figure, resolved objection still flagged as open. But with
              embedding-based memory, there's no file to open, no line to edit. The fix is either "tell the agent
              again" or "purge and restart."
            </p>
            <p style={{ marginTop: 14 }}>
              At scale, stale memory in sales AI is a pipeline risk. If your agent is advising ten reps across forty
              active deals and carries wrong context forward, you need to be able to find it, fix it, and know it's
              fixed — not hope re-extraction catches it next session.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Deal context that persists. Stale facts that ops can fix directly.</h2>
        <div className="split">
          <div className="path-panel">
            <h3>What the agent writes</h3>
            <p>
              As the agent works through calls and follow-ups, it writes durable deal context to structured memory
              files: stakeholder map, objection log, agreed next steps, budget and timeline signals. Each file is
              path-addressable — <code>user/deal-context.md</code>, <code>user/objections.md</code>,
              <code>user/stakeholders.md</code> — readable by any agent in the pipeline handling this prospect.
            </p>
            <pre>{`// After a discovery call
await memory_remember({
  content: \`## Deal context — Acme Corp
Stakeholders: Sarah (champion), Tom (legal blocker)
Budget: ~$40K approved, needs CFO sign-off above $50K
Key objection: data residency — needs EU hosting option
Timeline: Q3 close, legal review starts June
Next step: send EU data residency one-pager to Sarah\`,
  path: "user/deal-context.md"
})`}</pre>
          </div>
          <div className="path-panel">
            <h3>What sales ops can do</h3>
            <p>
              When a deal updates — budget approved, stakeholder changes, objection resolved — sales ops opens the
              memory file in the admin console and edits the line. The next agent session picks up the corrected
              context. No redeployment. No re-extraction. No waiting for the model to re-learn it from new
              conversation turns.
            </p>
            <p style={{ marginTop: 14 }}>
              Revision history shows every version of every deal file — when context was written, what changed, and
              which call it came from via the tool call ID. When a deal goes wrong and you need to understand what the
              agent believed at each stage, it's all there.
            </p>
            <p style={{ marginTop: 14 }}>
              Shared files under <code>shared/</code> hold qualification criteria, discovery frameworks, and objection
              playbooks. Update a playbook once — every rep's agent session gets it on the next call without a
              deployment.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Sales context that compounds, not resets.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Deal context, objection history, and stakeholder map persist across every call and session.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Sales ops can correct stale facts directly — before the wrong context reaches the next call.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Qualification frameworks and playbooks in shared memory update once, reach all reps' agents.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Revision history gives a per-deal audit trail — reconstruct what the agent believed at any stage.</span>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Docs</div>
        <h2>Go deeper.</h2>
        <div className="uc-links">
          <Link href="/docs/concepts/memory-tools" className="uc-link">
            Memory tools <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/shared-memory" className="uc-link">
            Shared memory <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/revisions" className="uc-link">
            Revisions <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/quickstart/docker-service" className="uc-link">
            Docker quickstart <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
