import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CheckCircle2, Database, FileClock, Network, Search, XCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI vs Mem0, Zep, and Vector Memory',
  description:
    'Compare MemexAI with Mem0, Zep, and vector-store memory for AI products that need persistent, inspectable user memory.',
  alternates: {
    canonical: '/compare',
  },
  openGraph: {
    title: 'MemexAI vs Mem0, Zep, and Vector Memory',
    description:
      'A practical comparison for AI products choosing between inspectable memory files, vector retrieval, and graph memory.',
    url: 'https://memexai.space/compare',
  },
};

const rows = [
  ['Primary model', 'Inspectable memory files', 'Embedded facts / retrieval', 'Temporal graph memory', 'Raw chat chunks'],
  ['Default storage', 'Postgres', 'Vector/KV infra', 'Graph-oriented service', 'Vector database'],
  ['Human editing', 'Direct file inspection and edits', 'Indirect', 'Indirect', 'Indirect'],
  ['Revision history', 'Built in', 'Not the core abstraction', 'Not the core abstraction', 'Usually custom'],
  ['Best fit', 'B2C AI products that must remember users', 'Fact recall across sessions', 'Conversation intelligence', 'Semantic search over logs'],
];

const fitCards = [
  {
    icon: CheckCircle2,
    title: 'Choose MemexAI when memory is a product surface',
    text: 'Use MemexAI when founders, support, or ops teams need to inspect what an AI remembered, fix wrong records, and preserve a user model across sessions.',
  },
  {
    icon: Search,
    title: 'Choose retrieval when old text is the source of truth',
    text: 'Vector retrieval is useful when the job is finding relevant fragments from a large archive. MemexAI is for the smaller set of durable facts the agent should maintain.',
  },
  {
    icon: XCircle,
    title: 'Do not use MemexAI as a transcript warehouse',
    text: 'Keep raw logs in your app, warehouse, or audit store. Feed MemexAI the preferences, constraints, decisions, and stable facts that should survive.',
  },
];

export default function ComparePage() {
  return (
    <main className="site-shell">
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <Database size={15} aria-hidden />
            AI memory comparison
          </div>
          <h1>MemexAI vs Mem0, Zep, and vector-store memory.</h1>
          <p className="section-lede">
            Most memory tools optimize for retrieving old text. MemexAI optimizes for maintaining a clean, inspectable
            model of each user that your AI product can read, update, and trust.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/quickstart/docker-service">
              Start with Docker
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/walkthroughs">
              Watch the walkthrough path
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Short version</div>
        <h2>If users need to feel remembered, memory has to be legible.</h2>
        <p className="section-lede">
          Mem0, Zep, and vector databases can be good retrieval systems. MemexAI is different: it gives the agent a
          scoped filesystem in Postgres, then records revisions and reads so your team can operate memory like product
          data.
        </p>

        <div className="compare-table" role="table" aria-label="AI memory comparison table">
          <div className="compare-row compare-head" role="row">
            <div role="columnheader">Question</div>
            <div role="columnheader">MemexAI</div>
            <div role="columnheader">Mem0</div>
            <div role="columnheader">Zep</div>
            <div role="columnheader">Vector DB</div>
          </div>
          {rows.map((row) => (
            <div className="compare-row" role="row" key={row[0]}>
              {row.map((cell) => (
                <div role="cell" key={cell}>
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Use case fit</div>
        <h2>The important split is durable user memory vs chat-log retrieval.</h2>
        <div className="feature-grid">
          {fitCards.map((card) => {
            const Icon = card.icon;
            return (
              <div className="feature" key={card.title}>
                <Icon size={24} aria-hidden />
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Why teams switch</div>
        <h2>Inspectable memory makes personalization debuggable.</h2>
        <div className="split">
          <div className="path-panel">
            <FileClock size={24} aria-hidden />
            <h3>Revisions explain how memory changed</h3>
            <p>
              Every write creates a revision, so teams can see what changed after a session instead of guessing which
              hidden extraction or embedding caused a behavior.
            </p>
          </div>
          <div className="path-panel">
            <Database size={24} aria-hidden />
            <h3>Postgres keeps the stack boring</h3>
            <p>
              Run the service with Docker, use the TypeScript or Python SDK, or embed the core runtime directly when
              your app should own database credentials.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Focused comparisons</div>
        <h2>Need the direct version?</h2>
        <div className="feature-grid">
          <Link className="feature link-card" href="/compare/mem0">
            <Search size={24} aria-hidden />
            <h3>MemexAI vs Mem0</h3>
            <p>For teams comparing extracted memory and retrieval against inspectable Postgres memory files.</p>
          </Link>
          <Link className="feature link-card" href="/compare/zep">
            <Network size={24} aria-hidden />
            <h3>MemexAI vs Zep</h3>
            <p>For teams comparing graph-oriented memory against a self-hosted user memory workspace.</p>
          </Link>
          <Link className="feature link-card" href="/compare/vector-database">
            <Database size={24} aria-hidden />
            <h3>MemexAI vs Vector DB</h3>
            <p>For teams deciding whether they need semantic transcript retrieval or durable user memory.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
