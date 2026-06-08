import Link from 'next/link'
import { ArrowRight, BookOpen, Calendar, Database } from 'lucide-react'
import { HeroFileAnimation } from '@/components/marketing/hero-file-animation'
import { FileBrowser } from '@/components/marketing/file-browser'
import { DiffWidget } from '@/components/marketing/diff-widget'
import { CodeSwitcher } from '@/components/marketing/code-switcher'
import { CopyButton } from '@/components/marketing/copy-button'
import { Reveal } from '@/components/reveal'
import { getFounderCallUrl } from '@/lib/links'
import { slackUrl } from '@/lib/links'

const SETUP_PROMPT = `Setup MemexAI in my project. Read the guides at https://memexai.space/setup.md to install the SDK, wire the pg pool, and run a smoke test.`

export default function HomePage() {
  const founderCallUrl = getFounderCallUrl()

  return (
    <main>
      {/* ── §1 HERO ──────────────────────────────────────────────────── */}
      <section className="mx-hero">
        <div className="mx-hero-inner">
          <div>
            <div className="mx-eyebrow">
              <Database size={14} aria-hidden />
              Memory infra for AI agents
            </div>

            <h1>Your agent forgets users between sessions. That&apos;s the bug.</h1>

            <p className="mx-hero-copy">
              MemexAI gives your agent a persistent memory layer backed by Postgres.
              Memories are human-readable Markdown files with revision history,
              access logs, and scoped permissions. You can inspect every fact, fix
              mistakes, and trace what the agent remembered and why.
            </p>

            <div className="mx-hero-actions">
              <CopyButton
                text={SETUP_PROMPT}
                label="Copy Setup Prompt"
              />
              <Link
                className="mx-btn mx-btn-secondary"
                href="/docs/quickstart/docker-service"
                data-analytics-event="cta_clicked"
                data-analytics-label="home_quickstart"
              >
                <BookOpen size={15} aria-hidden />
                Read Quickstart
                <ArrowRight size={15} aria-hidden />
              </Link>
            </div>

            <p style={{ marginTop: 14, color: 'var(--mx-muted)', fontSize: 12 }}>
              Paste the prompt into Cursor, Claude, or Antigravity to automate setup.
            </p>
          </div>

          <HeroFileAnimation />
        </div>
      </section>

      {/* ── §2 THE PROBLEM ───────────────────────────────────────────── */}
      <section className="mx-section">
        <Reveal>
          <span className="mx-kicker">The problem</span>
          <h2>Two ways agent memory fails in production</h2>
        </Reveal>

        <Reveal stagger className="mx-problem-grid">
          <div className="mx-problem-card">
            <div className="mx-problem-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Stateless agents lose users</h3>
            <p>
              Without persistent memory, your agent starts fresh every session.
              Users repeat their preferences, re-explain their goals, and eventually
              stop coming back. The AI feels like it has amnesia.
            </p>
            <div className="mx-problem-chat">
              &ldquo;I already told you I moved to London.&rdquo;
            </div>
          </div>

          <div className="mx-problem-card">
            <div className="mx-problem-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Vector stores should not be the source of truth</h3>
            <p>
              Dumping conversations into a vector database retrieves similar-looking
              fragments — including outdated or conflicting ones. When the agent says
              something wrong, you need an editable memory record, not just a nearest
              neighbor.
            </p>
            <div className="mx-problem-blur" aria-label="Opaque memory representation">
              ??? ??? ???
            </div>
          </div>
        </Reveal>
      </section>

      <hr className="mx-divider" />

      {/* ── §3 THE SOLUTION ──────────────────────────────────────────── */}
      <section className="mx-section">
        <Reveal>
          <span className="mx-kicker">The solution</span>
          <h2>Memory as Markdown files in your Postgres</h2>
          <p className="mx-lede">
            MemexAI stores what your agent knows about each user as structured
            Markdown files — not embeddings as the source of truth. Files live in
            your own Postgres database. Optional pgvector ranking can improve recall,
            while the memory record stays readable and editable.
          </p>
        </Reveal>

        <Reveal>
          <FileBrowser />
        </Reveal>

        <Reveal stagger className="mx-scope-grid">
          <div className="mx-scope-card">
            <code>user/**</code>
            <strong>Private per tenant</strong>
            <p>
              Each user gets their own memory directory. Agents read and write freely.
              Other users can&apos;t see it.
            </p>
          </div>
          <div className="mx-scope-card">
            <code>shared/**</code>
            <strong>Global read-only</strong>
            <p>
              Project-wide policies, style guides, and workflows. Agents read
              but can&apos;t write by default.
            </p>
          </div>
        </Reveal>
      </section>

      <hr className="mx-divider" />

      {/* ── §4 SHARED MEMORY ─────────────────────────────────────────── */}
      <section className="mx-section">
        <Reveal>
          <span className="mx-kicker">Global Knowledge</span>
          <h2>Give all your agents a shared brain</h2>
          <p className="mx-lede">
            The <code>shared/</code> namespace holds global policies, product schemas, and behavioral rules.
            Update a schema or rule once, and it instantly propagates to every agent session. No code deployments required.
          </p>
        </Reveal>

        <Reveal stagger className="mx-problem-grid">
          <div className="mx-card">
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>Behavioral Rules</h3>
            <p style={{ fontSize: 14, color: 'var(--mx-muted)', margin: 0, lineHeight: 1.6 }}>
              Store <code>shared/playbook.md</code> to define how agents should handle specific situations (e.g., support escalations). The agent reads it before every session.
            </p>
          </div>
          <div className="mx-card">
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>Memory Schemas</h3>
            <p style={{ fontSize: 14, color: 'var(--mx-muted)', margin: 0, lineHeight: 1.6 }}>
              Define what a &quot;good&quot; user profile looks like. If you add a new required field to the schema, agents will automatically start asking users for it.
            </p>
          </div>
          <div className="mx-card">
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>Auto-Injection</h3>
            <p style={{ fontSize: 14, color: 'var(--mx-muted)', margin: 0, lineHeight: 1.6 }}>
              <code>shared/index.md</code> is automatically injected into every prompt block. It acts as a routing catalog for your agent&apos;s collective knowledge.
            </p>
          </div>
          <div className="mx-card">
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>Collective Memory</h3>
            <p style={{ fontSize: 14, color: 'var(--mx-muted)', margin: 0, lineHeight: 1.6 }}>
              Optionally configure <code>shared/</code> as read-write. Trusted agents can update project canon, backed by full audit trails and the ability to revert any change.
            </p>
          </div>
        </Reveal>
      </section>

      <hr className="mx-divider" />

      {/* ── §5 BACKGROUND DREAMING ─────────────────────────────────────── */}
      <section className="mx-section">
        <Reveal>
          <span className="mx-kicker">Maintenance</span>
          <h2>Background Dreaming keeps memory clean</h2>
          <p className="mx-lede">
            Memory files can get messy over time with duplicate facts or scattered notes.
            MemexAI&apos;s Dreaming is a background optimization loop that runs when a user session goes quiet.
          </p>
        </Reveal>

        <Reveal stagger className="mx-scope-grid">
          <div className="mx-scope-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div style={{ color: 'var(--mx-accent)', marginBottom: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <strong style={{ marginTop: 0 }}>Compaction & Deduplication</strong>
            <p>
              Merges repeated preferences, removes outdated or corrected facts, and consolidates fragmented notes into a stable record without blocking the main user request.
            </p>
          </div>
          <div className="mx-scope-card">
            <div style={{ color: 'var(--mx-muted)', marginBottom: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <strong style={{ marginTop: 0 }}>Zero Audit Noise</strong>
            <p>
              Dream runs that find nothing to change complete silently. When they do make updates, they create normal revisions authored by the <code>dream-agent</code>.
            </p>
          </div>
        </Reveal>
      </section>

      <hr className="mx-divider" />

      {/* ── §6 TRUST SURFACE ─────────────────────────────────────────── */}
      <section className="mx-section">
        <Reveal>
          <span className="mx-kicker">Debuggability</span>
          <h2>When the AI gets a fact wrong, open the file and fix it.</h2>
          <p className="mx-lede">
            Edit the Markdown line, and the next prompt block updates instantly.
            Hybrid deployments refresh optional pgvector ranking on writes. Revisions
            track every write. Access logs track every read. You can trace exactly
            which tool call wrote the wrong fact.
          </p>
        </Reveal>

        <Reveal>
          <DiffWidget />
        </Reveal>
      </section>

      <hr className="mx-divider" />

      {/* ── §5 SETUP / DX ────────────────────────────────────────────── */}
      <section className="mx-section">
        <Reveal>
          <span className="mx-kicker">Get started</span>
          <h2>Add memory to your agent in 4 lines</h2>
          <p className="mx-lede">
            Start with Docker. Connect with the TypeScript SDK or MCP. Or paste a
            setup prompt into your coding agent and let it wire everything automatically.
          </p>
        </Reveal>

        <Reveal>
          <CodeSwitcher />
        </Reveal>

        <Reveal stagger className="mx-scope-grid">
          <div className="mx-scope-card">
            <code>memory subagent</code>
            <strong>Recommended default</strong>
            <p>
              Give the model <code>memory_memorize</code> and <code>memory_search</code>;
              MemexAI decides what is durable, searches memory, and handles file bookkeeping.
            </p>
          </div>
          <div className="mx-scope-card">
            <code>raw file tools</code>
            <strong>Exact file control</strong>
            <p>
              Use file-level tools when your app or agent owns the memory layout
              and needs exact path control over durable files.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="mx-agent-prompt">
            <div className="mx-agent-prompt-label">
              Or copy this into your coding agent:
            </div>
            <div className="mx-agent-prompt-box">
              <span>Setup MemexAI by following https://memexai.space/setup.md</span>
              <CopyButton
                text={SETUP_PROMPT}
                label=""
                className="mx-copy-btn-inline"
              />
            </div>
          </div>
        </Reveal>
      </section>

      <hr className="mx-divider" />

      {/* ── §6 COMPARE ───────────────────────────────────────────────── */}
      <section className="mx-section">
        <Reveal>
          <span className="mx-kicker">Compare</span>
          <h2>How MemexAI compares</h2>
        </Reveal>

        <Reveal>
          <div className="mx-compare">
            <div className="mx-compare-row mx-compare-head">
              <div></div>
              <div data-col="memex">MemexAI</div>
              <div>Mem0</div>
              <div>Zep</div>
              <div>DIY</div>
            </div>
            <div className="mx-compare-row">
              <div>Storage</div>
              <div data-col="memex">Your Postgres</div>
              <div>Their cloud</div>
              <div>Their cloud</div>
              <div>Varies</div>
            </div>
            <div className="mx-compare-row">
              <div>Memory format</div>
              <div data-col="memex">Markdown files</div>
              <div>JSON blobs</div>
              <div>Knowledge graph</div>
              <div>Custom</div>
            </div>
            <div className="mx-compare-row">
              <div>Human-readable</div>
              <div data-col="memex" className="mx-compare-check">✓ Open the file</div>
              <div className="mx-compare-x">✗ API-only</div>
              <div className="mx-compare-x">✗ API-only</div>
              <div>Depends</div>
            </div>
            <div className="mx-compare-row">
              <div>Fix a wrong fact</div>
              <div data-col="memex">Edit one line</div>
              <div>Re-extract</div>
              <div>Re-process</div>
              <div>Write migration</div>
            </div>
            <div className="mx-compare-row">
              <div>Revision history</div>
              <div data-col="memex" className="mx-compare-check">✓ Built-in</div>
              <div className="mx-compare-x">✗</div>
              <div className="mx-compare-x">✗</div>
              <div>Build it yourself</div>
            </div>
            <div className="mx-compare-row">
              <div>Self-hosted</div>
              <div data-col="memex" className="mx-compare-check">✓ Docker</div>
              <div>Paid cloud</div>
              <div>Paid cloud</div>
              <div className="mx-compare-check">✓</div>
            </div>
          </div>

          <Link href="/compare" className="mx-compare-link">
            See full comparison
            <ArrowRight size={14} aria-hidden />
          </Link>
        </Reveal>
      </section>

      {/* ── §7 FOOTER CTA ────────────────────────────────────────────── */}
      <section className="mx-cta-band">
        <div className="mx-section">
          <Reveal>
            <span className="mx-kicker">Build the record</span>
            <h2>Give your agent memory your team can trust.</h2>
            <p className="mx-lede">
              Start with Docker, MCP, or the TypeScript SDK. Store memory, inject
              context, verify the next answer changes.
            </p>
            <div className="mx-cta-actions">
              <Link
                className="mx-btn mx-btn-primary"
                href="/docs"
                data-analytics-event="cta_clicked"
                data-analytics-label="home_view_docs"
              >
                <BookOpen size={15} aria-hidden />
                View docs
              </Link>
              <Link
                className="mx-btn mx-btn-secondary"
                href="/docs/quickstart/docker-service"
                data-analytics-event="cta_clicked"
                data-analytics-label="home_docker_quickstart"
              >
                Docker quickstart
              </Link>
              <Link
                className="mx-btn mx-btn-secondary"
                href="/roadmap"
                data-analytics-event="cta_clicked"
                data-analytics-label="home_roadmap"
              >
                Roadmap
              </Link>
              <a
                className="mx-btn mx-btn-secondary"
                href={founderCallUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-event="cta_clicked"
                data-analytics-label="home_talk_to_us_footer"
              >
                <Calendar size={15} aria-hidden />
                Talk to us
              </a>
              <a
                className="mx-btn mx-btn-secondary"
                href={slackUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-event="cta_clicked"
                data-analytics-label="home_slack"
              >
                Community
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
