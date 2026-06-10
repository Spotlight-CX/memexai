import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Conversation extraction — MemexAI',
  description:
    'How to extract durable memory facts from conversation transcripts and write them as structured MemexAI files — post-session hooks or batch historical ingestion.',
  alternates: { canonical: '/use-cases/conversation-extraction' },
  openGraph: {
    title: 'Conversation extraction — MemexAI',
    description:
      'Bootstrap agent memory from existing conversation logs — turn months of session history into structured, inspectable memory files without replaying every message live.',
    url: 'https://memexai.space/use-cases/conversation-extraction',
  },
}

export default function ConversationExtractionPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Memory bootstrap</div>
          <h1>Turn conversation history into structured memory.</h1>
          <p className="section-lede">
            Most teams adopting memory infrastructure already have months of conversation data. A post-session
            extraction hook — or a batch pipeline over historical logs — gives every user a bootstrapped memory profile
            from day one, without replaying every message through a live agent.
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
        <h2>Memory infrastructure has a cold-start problem.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              The agent-write path is the right long-term solution — the agent learns as it works, writes what it
              discovers, and builds a richer profile over time. But it only captures the future. A new deployment starts
              with empty memory, and every user gets the same blank-slate experience regardless of how long they've been
              a customer.
            </p>
            <p style={{ marginTop: 14 }}>
              For a coaching app, that means the AI asks about goals the user already explained months ago. For a
              support agent, it re-establishes context that was resolved in a prior ticket. For a sales assistant, it
              misses deal history that exists in session logs but nowhere else.
            </p>
          </div>
          <div className="path-panel">
            <p>
              The obvious fix — replaying historical conversations through a live agent — is slow, expensive, and
              fragile. Every historical session runs at full inference cost. Tool calls fire against live systems.
              Failures mid-replay leave memory in a partial state with no easy way to resume.
            </p>
            <p style={{ marginTop: 14 }}>
              Storing raw conversation logs in a vector index gives you retrieval but not memory. The agent can search
              past transcripts but can't distinguish a one-time request from a durable preference, and can't update a
              belief when the user's situation changes.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Extract once. Inherit everywhere.</h2>
        <p className="section-lede">
          A lightweight extraction pass reads a conversation transcript, identifies what's worth remembering, and writes
          it as a structured memory file. Future sessions inherit the extracted context via the prompt block — the same
          path as live-written memory.
        </p>
        <div className="split">
          <div className="path-panel">
            <h3>Post-session hook or batch pipeline</h3>
            <p>
              Run extraction as a post-session hook after each conversation closes, or as a one-time batch job over
              historical logs. The extraction LLM filters out ephemeral content and writes only durable facts — the
              signal, not the noise. The <code>reason</code> field tags every write as{' '}
              <code>'conversation-extraction'</code> so you can distinguish bootstrapped memory from live-written memory
              in the access log.
            </p>
            <pre>{`import { createMemex } from '@memexai/core'
import { generateText } from 'ai'

const memex = createMemex(DATABASE_URL)

type Message = { role: 'user' | 'assistant'; content: string }

async function extractMemory(
  userId: string,
  transcript: Message[],
) {
  const { text: facts } = await generateText({
    model,
    system: \`Extract durable facts worth remembering.
Focus on: preferences, decisions, recurring context.
Ignore: one-time requests, pleasantries, ephemeral state.
Return concise Markdown bullet points.\`,
    prompt: transcript
      .map(m => \`\${m.role}: \${m.content}\`)
      .join('\\n'),
  })

  if (!facts.trim()) return

  const user = memex.forUser({
    userId,
    actor: 'extraction-pipeline',
  })
  await user.write(
    'user/extracted.md',
    facts,
    'conversation-extraction',
  )
}

// Run after each session closes
await extractMemory(userId, session.messages)`}</pre>
          </div>
          <div className="path-panel">
            <h3>What the agent inherits</h3>
            <p>
              Extracted memory files appear in the prompt block alongside live-written memory. The agent gets full
              context from the first session — no cold start, no re-establishing what the user already told a previous
              version of the system.
            </p>
            <p style={{ marginTop: 14 }}>
              Revision history shows when each extracted fact was written, by which pipeline run, and from which
              source. If an extracted belief turns out to be wrong, your team can correct it directly in the admin
              console — same correction surface as any other memory file.
            </p>
            <p style={{ marginTop: 14 }}>
              The extraction prompt can live in <code>shared/</code> memory — a shared file that defines what counts
              as worth remembering for your product. Update the extraction policy without redeploying the pipeline.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Zero cold start on day one.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>
              Bootstrapped memory from existing logs — users get personalized responses from the first session.
            </span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>
              Extraction writes are tagged separately in access logs — you always know what came from extraction vs.
              live sessions.
            </span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>
              Extracted facts are correctable — open any file in the admin console and fix wrong beliefs before they
              reach users.
            </span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Extraction prompt lives in shared memory — tune what gets remembered without redeploying.</span>
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
          <Link href="/docs/concepts/revisions" className="uc-link">
            Revisions <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/access-logs" className="uc-link">
            Access logs <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/shared-memory" className="uc-link">
            Shared memory <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
