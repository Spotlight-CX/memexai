import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Debuggable agent memory infrastructure — MemexAI',
  description:
    'How agent infrastructure teams use MemexAI audit logs and revision history to debug memory failures without reverse-engineering a vector index — separate writes from reads from ignores.',
  alternates: { canonical: '/use-cases/agent-infrastructure' },
  openGraph: {
    title: 'Debuggable agent memory infrastructure — MemexAI',
    description:
      'Access logs, revision history, and per-file inspection that separate write failures from retrieval failures from retrieve-and-ignore.',
    url: 'https://memexai.space/use-cases/agent-infrastructure',
  },
}

export default function AgentInfrastructurePage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">Agent infrastructure teams</div>
          <h1>Diagnose memory failures without guessing.</h1>
          <p className="section-lede">
            When an agent behaves wrong, the question is: did it fail to write, write the wrong thing, retrieve the
            wrong entry, or retrieve correctly and ignore? MemexAI separates these failure modes with access logs,
            revision history, and file-level inspection.
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
        <h2>Embedding-based memory conflates four different failure modes.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              Personalization failures have four distinct causes: the agent didn't write the fact, the agent wrote the
              wrong fact, retrieval returned something else, or retrieval worked but the model ignored it. Debugging any
              of these is hard when memory is a vector index.
            </p>
            <p style={{ marginTop: 14 }}>
              You can query for similar entries, but you can't see a write log. You can look at retrieval results, but
              you can't see the reads that happened during a specific session. You can inspect current embeddings, but
              you can't roll back to the state the agent had when it made the wrong call.
            </p>
          </div>
          <div className="path-panel">
            <p>
              In practice, infrastructure teams spend hours on failures that should take minutes. You know the output was
              wrong. You know it involves memory. But the memory layer gives you no surface to separate "wasn't there" from
              "was there but not retrieved" from "was retrieved but not used."
            </p>
            <p style={{ marginTop: 14 }}>
              The situation is worse when failures are intermittent — a retrieval that usually works, failing for specific
              users under specific conditions. Without a read log tied to specific sessions and tool calls, reproducing
              the issue requires either sampling luck or expensive synthetic testing.
            </p>
            <p style={{ marginTop: 14 }}>
              At scale, you also need to know which changes improved personalization quality. Without a revision trail,
              you can't attribute behavioral changes to specific memory writes.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>Three surfaces for three failure modes.</h2>
        <div className="split">
          <div className="path-panel">
            <h3>Access logs — separate reads from writes</h3>
            <p>
              Every read and write is logged with a timestamp, the tool call ID, the user ID, and the file path. When an
              agent session goes wrong, pull the access log for that session: you can see exactly which files were
              read (and which were not), which were written, and in what order.
            </p>
            <p style={{ marginTop: 14 }}>
              This immediately separates "agent didn't write" from "wrote but didn't retrieve" from "retrieved but not
              injected." The failure mode determines the fix: a prompt change, a retrieval tuning, or an injection issue.
            </p>
          </div>
          <div className="path-panel">
            <h3>Revisions — separate current state from history</h3>
            <p>
              Every write creates a revision with the full file content at that point. You can open any file and see
              every version it has ever had, when each was written, and which tool call wrote it.
            </p>
            <p style={{ marginTop: 14 }}>
              For an incident at a specific time, reconstruct the exact memory state the agent had: what was in each file
              at that moment, what had been written by then, what had been read. No guessing about what the agent knew.
            </p>
            <pre>{`// Incident reconstruction
// 1. Find the session from access logs
// 2. Pull revisions for relevant files at that timestamp
// 3. Reconstruct the exact prompt block the agent received

SELECT content_text, created_at, actor
FROM mx_revision
WHERE file_id = $fileId
  AND created_at <= $incidentTime
ORDER BY created_at DESC
LIMIT 1;`}</pre>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Memory failures become diagnosable in minutes.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Access logs tied to tool call IDs — every read and write is traceable to a specific model call.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Full revision history per file — reconstruct any user's memory state at any point in time.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Write, retrieval, and injection failures are separable — each has a distinct diagnostic path.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Admin console exposes all of this without writing SQL — useful for ops teams, not just engineers.</span>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Docs</div>
        <h2>Go deeper.</h2>
        <div className="uc-links">
          <Link href="/docs/concepts/access-logs" className="uc-link">
            Access logs <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/revisions" className="uc-link">
            Revisions <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/operations/admin-console" className="uc-link">
            Admin console <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/how-it-works" className="uc-link">
            How it works <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
