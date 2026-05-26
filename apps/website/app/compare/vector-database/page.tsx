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
            maintained record of preferences, decisions, constraints, and corrections that people can inspect.
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

      <section className="section contrast-section">
        <div className="section-kicker">Rule of thumb</div>
        <h2>Use both if you need both archive search and durable personalization.</h2>
        <p className="section-lede">
          Keep raw transcripts and semantic search where they belong. Use MemexAI for the smaller working set your AI
          should carry forward: preferences, constraints, decisions, timelines, and source-backed updates.
        </p>
      </section>
    </main>
  );
}
