import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Database, FileSearch, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI vs Vector Database Memory',
  description:
    'Compare inspectable Postgres memory files with vector database memory for AI products that need durable user personalization.',
  alternates: {
    canonical: '/compare/vector-database',
  },
  openGraph: {
    title: 'MemexAI vs Vector Database Memory',
    description:
      'When to use MemexAI instead of a vector database for persistent, inspectable user memory in AI products.',
    url: 'https://memexai.space/compare/vector-database',
  },
};

export default function VectorDatabaseComparePage() {
  return (
    <main className="site-shell">
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <Search size={15} aria-hidden />
            Vector database alternative
          </div>
          <h1>MemexAI vs vector database memory.</h1>
          <p className="section-lede">
            Vector search is excellent for finding similar text. Persistent user memory needs something else too: a
            maintained record of preferences, decisions, constraints, corrections, and policies that people can inspect.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/quickstart/docker-service">
              Start with Docker
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/compare">
              All comparisons
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Core difference</div>
        <h2>Vector databases retrieve old text. MemexAI maintains what should survive.</h2>
        <div className="split">
          <div className="path-panel">
            <Database size={24} aria-hidden />
            <h3>MemexAI</h3>
            <p>
              Agents write durable memory into scoped files. The files live in Postgres, carry revision history, and can
              be inspected from the admin UI.
            </p>
          </div>
          <div className="path-panel">
            <FileSearch size={24} aria-hidden />
            <h3>Vector memory</h3>
            <p>
              Store conversation chunks, embed them, retrieve similar fragments, and inject them into the prompt. Useful,
              but not the same as a maintained user record.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Technical tradeoff</div>
        <h2>Semantic similarity is not the same as memory state.</h2>
        <div className="compare-table" role="table" aria-label="MemexAI and vector database technical comparison">
          <div className="compare-row compare-head two-col-row" role="row">
            <div role="columnheader">Question</div>
            <div role="columnheader">MemexAI</div>
            <div role="columnheader">Vector database</div>
          </div>
          {[
            ['What does the agent read?', 'Curated files that represent current memory', 'Nearest chunks from an embedded archive'],
            ['How are updates handled?', 'Patch or rewrite the durable record with revisions', 'Append/update source text and re-index embeddings'],
            ['How do you remove stale facts?', 'Edit the file that owns the fact', 'Find affected chunks, delete/update them, re-index'],
            ['Best fit', 'Current user model and behavior guidance', 'Transcript search, document search, and broad recall'],
          ].map((row) => (
            <div className="compare-row two-col-row" role="row" key={row[0]}>
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
        <div className="section-kicker">Rule of thumb</div>
        <h2>Use both if you need both archive search and durable personalization.</h2>
        <p className="section-lede">
          Keep raw transcripts and semantic search where they belong. Use MemexAI for the smaller working set your AI
          should carry forward: preferences, constraints, decisions, timelines, and source-backed updates.
        </p>
        <div className="hero-actions">
          <Link className="site-button site-button-primary" href="/blog/long-horizon-agents-need-memory">
            Read the long-horizon memory essay
            <ArrowRight size={17} aria-hidden />
          </Link>
          <Link className="site-button site-button-secondary" href="/docs/concepts/shared-memory">
            Shared memory guide
          </Link>
        </div>
      </section>
    </main>
  );
}
