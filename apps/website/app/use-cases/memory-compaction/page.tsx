import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Memory compaction — MemexAI',
  description:
    'How to run a scheduled background agent that reads all user memory, uses an LLM to compact and deduplicate, and writes back cleaner files — with full revision history.',
  alternates: { canonical: '/use-cases/memory-compaction' },
  openGraph: {
    title: 'Memory compaction — MemexAI',
    description:
      'Keep agent memory clean and accurate over time — a scheduled compaction pass that merges duplicates, removes stale facts, and keeps the prompt block tight.',
    url: 'https://memexai.space/use-cases/memory-compaction',
  },
}

export default function MemoryCompactionPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Memory health</div>
          <h1>Memory that stays accurate as your agent learns.</h1>
          <p className="section-lede">
            Every write improves memory. But over months of sessions, files accumulate noise — stale preferences,
            overlapping facts, partial updates that were never reconciled. A compaction pass reads all memory, merges
            what matters, and discards what doesn't. MemexAI revision history means the merge is always reversible.
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
        <h2>Memory that grows also degrades.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              The first few sessions write clean, high-signal facts. Then the user changes their mind. A preference gets
              updated but the old entry stays. Two sessions write similar facts in slightly different words. A goal that
              was written three months ago is no longer relevant — but the agent still reads it on every call.
            </p>
            <p style={{ marginTop: 14 }}>
              The prompt block grows. Retrieval starts returning older, lower-quality matches alongside fresh context.
              The agent's behavior becomes inconsistent — not because it forgot something, but because it's reading too
              much conflicting information at once.
            </p>
          </div>
          <div className="path-panel">
            <p>
              With embedding-based memory, this problem is invisible. You can't see which entries are redundant. You
              can't tell which old fact is winning retrieval over a newer correction. You can't clean the index without
              risking deleting something important.
            </p>
            <p style={{ marginTop: 14 }}>
              With file-based memory, the problem is at least visible — you can open the files and see the noise. But
              cleaning it by hand doesn't scale, and a compaction agent that writes without an audit trail is a liability
              rather than a solution.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Compaction that's auditable by design.</h2>
        <p className="section-lede">
          MemexAI's file-based memory is both the reason compaction is tractable and the reason it's safe. You can read
          all files, pass them to an LLM, and write back a merged result — and every version is preserved in revision
          history.
        </p>
        <div className="split">
          <div className="path-panel">
            <h3>The compaction agent</h3>
            <p>
              Call <code>user.list()</code> to enumerate all memory files for a user, read each one, send them to an
              LLM with a merge instruction, then write the result back. The <code>reason</code> field on the write tags
              every revision with <code>'scheduled-compaction'</code> so you can distinguish compaction writes from
              agent writes in the access log.
            </p>
            <pre>{`import { createMemex } from '@memexai/core'
import { generateText } from 'ai'

const memex = createMemex(DATABASE_URL)

async function compactMemory(userId: string) {
  const user = memex.forUser({
    userId,
    actor: 'compaction-agent',
  })

  const { files } = await user.list()
  const contents = await Promise.all(
    files.map(f => user.read(f.path))
  )

  const { text: compacted } = await generateText({
    model,
    system: \`Merge, deduplicate, and tighten these memory
files. Remove stale or redundant facts. Return one
clean Markdown document.\`,
    prompt: contents
      .map(c => \`## \${c.path}\\n\${c.content}\`)
      .join('\\n\\n'),
  })

  await user.write(
    'user/profile.md',
    compacted,
    'scheduled-compaction',
  )
}`}</pre>
          </div>
          <div className="path-panel">
            <h3>What you get</h3>
            <p>
              Every compaction write creates a revision. The admin console shows you exactly what changed — the full
              content before and after, the timestamp, and the <code>actor</code> field identifying the compaction
              agent. If the LLM merged something incorrectly, you can roll back to any prior revision in seconds.
            </p>
            <p style={{ marginTop: 14 }}>
              Run compaction as a cron job triggered after a user's memory has been quiet for a defined period —
              consistent with the background dreaming pattern. Quiet memory is a signal that the user's context has
              stabilized and is worth consolidating.
            </p>
            <p style={{ marginTop: 14 }}>
              The <code>shared/</code> namespace can hold a compaction prompt you tune over time — instructions for
              what to preserve, what to discard, and how to structure the merged output. Update the shared file and all
              future compaction runs reflect the change without a deployment.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>A memory layer that improves over time.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Every compaction write is revisioned — roll back any merge in seconds from the admin console.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>
              Access logs tag compaction writes separately from agent writes so you can audit what changed and why.
            </span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Prompt block stays tight — fewer redundant facts means better retrieval and lower token cost.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Compaction instructions live in shared memory — update the merge policy without redeploying.</span>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Docs</div>
        <h2>Go deeper.</h2>
        <div className="uc-links">
          <Link href="/docs/operations/dreaming" className="uc-link">
            Background Dreaming <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/revisions" className="uc-link">
            Revisions <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/memory-tools" className="uc-link">
            Memory tools <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/access-logs" className="uc-link">
            Access logs <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
