import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Multi-tenant SaaS memory — MemexAI',
  description:
    'How SaaS products use MemexAI for per-user memory that is physically isolated per tenant, auditable, and correctable by your ops team — not a black box you have to redeploy to fix.',
  alternates: { canonical: '/use-cases/multi-tenant-saas' },
  openGraph: {
    title: 'Multi-tenant SaaS memory — MemexAI',
    description:
      'Per-user memory scoped and isolated by design, with a correction surface your ops and support teams can actually use.',
    url: 'https://memexai.space/use-cases/multi-tenant-saas',
  },
}

export default function MultiTenantSaaSPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Multi-tenant SaaS</div>
          <h1>Per-user memory your ops team can open and fix.</h1>
          <p className="section-lede">
            Most memory tools give you a retrieval API. MemexAI gives you a correction surface — per-tenant files your
            support team can inspect, edit, and audit without writing a single migration.
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
        <h2>Memory that works in dev breaks trust in production.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              When an AI agent behaves differently for two users, you need to understand why. The question you're
              actually asking is: <em>what does the agent currently believe about this user?</em>
            </p>
            <p style={{ marginTop: 14 }}>
              With embedding-based memory, you can't answer that. You can query for similar entries, but you can't open
              a file and read what's stored. You can't see when a wrong fact was written, which tool call wrote it, or
              who has read it since.
            </p>
            <p style={{ marginTop: 14 }}>
              Support escalations become guessing games. You know the agent said the wrong thing — but you can't tell
              whether it was a write failure, a retrieval miss, or retrieved-and-ignored. Fixing it means either
              prompting around the problem or nuking the user's memory and starting over.
            </p>
          </div>
          <div className="path-panel">
            <p>
              At scale, this becomes an operational liability. You're shipping an AI product where the memory layer is
              invisible to the people responsible for keeping it working.
            </p>
            <p style={{ marginTop: 14 }}>
              Tenant isolation is also non-trivial to get right. A filter on a shared vector index is not the same as
              physical isolation. An edge case in your userId filtering can leak one user's context into another's
              session — silently.
            </p>
            <p style={{ marginTop: 14 }}>
              When you need to demonstrate data residency, explain what the agent knows about a user to a regulator, or
              just answer a support ticket, "it's in the vector index" is not an answer.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Memory as tenant-scoped files with a full audit trail.</h2>
        <p className="section-lede">
          Every user gets their own physical path namespace. Everything the agent learns is stored as structured files
          under <code>users/{'{userId}'}/**</code> — not a filtered view of a shared index.
        </p>
        <div className="split">
          <div className="path-panel">
            <h3>What your agent sees</h3>
            <p>
              The agent calls <code>memory_remember</code> and <code>memory_context</code>. MemexAI resolves all paths
              relative to the current user. The agent never sees physical paths or other users' data — the isolation is
              structural, not filtered.
            </p>
            <pre>{`const memex = createMemex(DATABASE_URL)

// Build prompt block for this user
const { block } = await memex.getPromptBlock({
  userId: req.user.id
})

// Wire tools — all scoped to this userId
const tools = memex.tools({ userId: req.user.id })

const result = await generateText({
  model,
  system: \`\${systemPrompt}\\n\\n\${block}\`,
  messages,
  tools,
})`}</pre>
          </div>
          <div className="path-panel">
            <h3>What your ops team sees</h3>
            <p>
              The admin console shows every memory file for every user. Click into any file to read its current content,
              see every revision with timestamps and tool call IDs, and view the full access log showing every read and
              write the agent has made.
            </p>
            <p style={{ marginTop: 14 }}>
              Correcting a wrong fact is a single edit. The change takes effect on the next agent session — no
              redeployment, no re-extraction, no migration.
            </p>
            <p style={{ marginTop: 14 }}>
              Revision history means you can reconstruct exactly what the agent believed at the time of any incident. If
              a user files a complaint, you can pull up their memory state from that exact moment.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Operability built into the memory layer.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Physical tenant isolation — not a userId filter on a shared index.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Every write creates a revision. Every read is logged with the tool call ID.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Support staff can correct wrong facts directly — no redeployment, no re-extraction.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Reconstruct any user's memory state at any point in time from revision history.</span>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Docs</div>
        <h2>Go deeper.</h2>
        <div className="uc-links">
          <Link href="/docs/concepts/scopes" className="uc-link">
            Scopes and isolation <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/revisions" className="uc-link">
            Revisions <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/operations/admin-console" className="uc-link">
            Admin console <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/quickstart/docker-service" className="uc-link">
            Docker quickstart <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
