import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Personal AI assistant memory — MemexAI',
  description:
    'How coaching apps, journaling assistants, and AI companions use MemexAI to build memory that users can see, correct, and trust — not a hidden profile they cannot change.',
  alternates: { canonical: '/use-cases/personal-ai-assistants' },
  openGraph: {
    title: 'Personal AI assistant memory — MemexAI',
    description:
      'Memory that grows with the user and stays correctable — the foundation for AI companions and coaching products where trust is the whole product.',
    url: 'https://memexai.space/use-cases/personal-ai-assistants',
  },
}

export default function PersonalAIAssistantsPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Personal AI assistants</div>
          <h1>Memory that grows with the user. And stays correctable.</h1>
          <p className="section-lede">
            For journaling apps, coaching bots, and AI companions, memory <em>is</em> the product. MemexAI stores what
            the agent learns as inspectable files — so users can see exactly what the AI knows about them, and correct
            it when it's wrong.
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
        <h2>A hidden memory profile is a liability.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              The promise of a personal AI assistant is that it knows you — your goals, your preferences, your context.
              That promise only holds if the memory is accurate. When it isn't, users notice immediately. And unlike a
              search ranking or a recommendation feed, a personal AI speaking with confident incorrectness feels like a
              betrayal.
            </p>
            <p style={{ marginTop: 14 }}>
              With embedding-based memory, the user has no recourse. They can't see what the assistant learned. They
              can't tell if it noted something correctly or misinterpreted a message. They can't fix a stale fact without
              explicitly re-explaining themselves — and even then, the old entry stays in the index, silently competing.
            </p>
          </div>
          <div className="path-panel">
            <p>
              Trust erodes quietly. The user corrects the AI once. It happens again. They stop engaging with topics the
              AI seems to have wrong. Retention drops not because the product is slow or buggy — but because the memory
              can't be trusted.
            </p>
            <p style={{ marginTop: 14 }}>
              The deeper problem is that memory without a correction surface is opaque by design. There's no admin panel
              a support person can open. No revision to roll back to. No way to tell whether a bad response came from
              wrong memory or a bad retrieval.
            </p>
            <p style={{ marginTop: 14 }}>
              For a product where memory <em>is</em> the moat, that opacity is the exact opposite of what you need.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Memory the user can see. Memory your team can fix.</h2>
        <p className="section-lede">
          MemexAI stores everything the agent learns about a user as path-addressable Markdown files in your own
          Postgres. Not embeddings. Not a managed cloud API. Files you can open, read, and edit.
        </p>
        <div className="split">
          <div className="path-panel">
            <h3>Integration</h3>
            <p>
              Call <code>getPromptBlock</code> to inject the user's current memory into the system prompt before every
              model call. Wire <code>memory_remember</code> and <code>memory_context</code> as tools so the agent can
              write durable facts and retrieve relevant context as it works.
            </p>
            <pre>{`import { createMemex } from '@memexai/core'
import { generateText } from 'ai'

const memex = createMemex(DATABASE_URL)

// Load everything the agent knows about this user
const { block } = await memex.getPromptBlock({
  userId: session.userId,
})

const { text } = await generateText({
  model,
  system: \`You are a personal AI assistant.\\n\\n\${block}\`,
  messages,
  // memory_remember: write a durable fact
  // memory_context: retrieve relevant context
  tools: memex.tools({ userId: session.userId }),
})`}</pre>
          </div>
          <div className="path-panel">
            <h3>What the user gets</h3>
            <p>
              Memory files are human-readable Markdown. A user asking "what do you remember about me?" gets an honest
              answer — because the answer is literally a file they can be shown. Your support team can open any user's
              memory in the admin console, see every revision with its timestamp and tool call ID, and edit wrong facts
              directly.
            </p>
            <p style={{ marginTop: 14 }}>
              The <code>shared/</code> namespace holds global guidance — tone instructions, product policies, schema
              definitions for what a well-structured user profile should contain. When you update the profile schema, all
              future agent sessions reflect it without a deployment.
            </p>
            <p style={{ marginTop: 14 }}>
              Background dreaming compacts and cleans memory files between sessions — merging duplicate notes, removing
              stale entries, keeping the profile accurate as the user evolves.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Memory that earns and keeps trust.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Human-readable files — users can see exactly what the AI learned about them.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Support can correct wrong facts in seconds, without touching code.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Revision history lets you explain any response: what did the agent know, and when did it learn it.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Background dreaming keeps the profile accurate as the user's situation changes.</span>
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
          <Link href="/docs/concepts/prompt-block" className="uc-link">
            Prompt block <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/operations/dreaming" className="uc-link">
            Background Dreaming <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
