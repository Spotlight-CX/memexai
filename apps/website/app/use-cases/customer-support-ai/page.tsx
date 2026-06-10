import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Customer support AI memory — MemexAI',
  description:
    'How customer support AI products use MemexAI to carry user context across sessions and tickets — and let support staff correct what the agent learned when something goes wrong.',
  alternates: { canonical: '/use-cases/customer-support-ai' },
  openGraph: {
    title: 'Customer support AI memory — MemexAI',
    description:
      'Stop asking users the same questions twice. MemexAI persists stable facts across every session and gives your team a direct correction surface.',
    url: 'https://memexai.space/use-cases/customer-support-ai',
  },
}

export default function CustomerSupportAIPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Customer support AI</div>
          <h1>Stop asking users the same questions twice.</h1>
          <p className="section-lede">
            The agent knows what plan the user is on. It was in the last ticket. MemexAI persists stable facts across
            sessions so the next conversation picks up where the last one ended — and gives your team a direct line to
            fix what gets wrong.
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
        <h2>Context that resets per ticket is not a support experience — it's a form.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              A user opens a ticket. The support agent asks about their plan tier, their integration setup, whether
              they're on the legacy API. The user answers. The ticket closes. Next week, different issue. The agent asks
              again.
            </p>
            <p style={{ marginTop: 14 }}>
              Every session without persistent memory is equivalent to a fresh onboarding. The user builds no
              relationship with the product. The agent derives no compound value from previous interactions. You're
              paying model costs to re-establish context that already existed.
            </p>
            <p style={{ marginTop: 14 }}>
              The deeper problem is distinguishing stable facts from ephemeral context. The user's plan tier is durable
              — worth storing and carrying forward. The specific error they saw last Tuesday is not. An agent that
              doesn't make this distinction either overwrites useful facts or pollutes memory with session noise.
            </p>
          </div>
          <div className="path-panel">
            <p>
              When something does go wrong — the agent gives advice based on an outdated plan tier, or misremembers a
              setting — your support team has no way to see or correct what's stored. They can tell the user to
              re-explain themselves, but they can't actually fix the underlying memory.
            </p>
            <p style={{ marginTop: 14 }}>
              For a support product, that's the worst failure mode: the AI gives wrong advice confidently, the support
              team can't explain why, and the fix is "start a new conversation."
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Stable facts that persist. Session noise that doesn't.</h2>
        <div className="split">
          <div className="path-panel">
            <h3>What the agent writes</h3>
            <p>
              The agent uses <code>memory_remember</code> to write facts that should outlive the session: plan tier,
              integration version, known issues, preferences. These go to <code>user/profile.md</code> or structured
              files like <code>user/integrations.md</code>.
            </p>
            <p style={{ marginTop: 14 }}>
              Shared files under <code>shared/</code> hold escalation policies, known product issues, support playbooks.
              Every agent session gets these injected — no redeploy needed when the playbook changes.
            </p>
            <pre>{`// Agent writes stable fact after first mention
await memory_remember({
  content: "User is on the Growth plan, using v2 API.",
  path: "user/profile.md"
})

// Next session: context is already loaded via getPromptBlock
// Agent knows plan tier before user says a word`}</pre>
          </div>
          <div className="path-panel">
            <h3>What your team can do</h3>
            <p>
              The admin console shows every user's memory files. When a user's plan changes and the agent still thinks
              they're on the old tier — open the file, update the line, done. The next session gets the corrected
              context.
            </p>
            <p style={{ marginTop: 14 }}>
              Access logs show every read and write with timestamps and tool call IDs. When you need to understand why
              the agent gave a specific response, you can trace the exact memory state it had at that moment.
            </p>
            <p style={{ marginTop: 14 }}>
              Revision history means corrections are always reversible. If a staff edit introduces a new error, roll
              back to any previous version.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Context continuity across every interaction.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Stable facts persist across sessions — users never re-explain their setup.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Support staff can update stale facts directly, without a deployment.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Shared policies (escalation rules, product guidance) update once and propagate to all sessions.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Access logs let you trace any response back to the exact memory state that produced it.</span>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Docs</div>
        <h2>Go deeper.</h2>
        <div className="uc-links">
          <Link href="/docs/concepts/how-it-works" className="uc-link">
            How it works <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/access-logs" className="uc-link">
            Access logs <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/shared-memory" className="uc-link">
            Shared memory <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/quickstart/docker-service" className="uc-link">
            Docker quickstart <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
