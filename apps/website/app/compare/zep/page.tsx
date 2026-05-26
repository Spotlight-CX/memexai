import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Database, FileClock, Network } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI vs Zep',
  description:
    'Compare MemexAI and Zep for teams that need self-hosted, inspectable AI user memory backed by Postgres.',
  alternates: {
    canonical: '/compare/zep',
  },
  openGraph: {
    title: 'MemexAI vs Zep',
    description:
      'A practical comparison for teams choosing between graph-oriented memory and inspectable Postgres memory files.',
    url: 'https://memexai.space/compare/zep',
  },
};

export default function ZepComparePage() {
  return (
    <main className="site-shell">
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <Network size={15} aria-hidden />
            Zep alternative
          </div>
          <h1>MemexAI vs Zep for self-hosted AI memory.</h1>
          <p className="section-lede">
            Zep is a strong fit when you want graph-oriented conversation memory. MemexAI is the simpler path when your
            product needs inspectable user memory files, revision history, and a Postgres-native deployment.
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
        <h2>Zep is graph-oriented memory. MemexAI is an inspectable memory workspace.</h2>
        <div className="split">
          <div className="path-panel">
            <Database size={24} aria-hidden />
            <h3>MemexAI</h3>
            <p>
              Run the service with Docker or use direct Postgres mode. Memory lives as scoped files that agents and
              humans can both read.
            </p>
          </div>
          <div className="path-panel">
            <Network size={24} aria-hidden />
            <h3>Zep</h3>
            <p>
              Focuses on conversation intelligence and graph memory. That can be useful, but it is a different operating
              model than editable user memory files.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">When to choose MemexAI</div>
        <h2>Choose MemexAI when the memory record needs to be simple enough for your team to debug.</h2>
        <div className="trust-list">
          <div>
            <FileClock size={20} aria-hidden />
            <span>Every write creates a revision you can inspect later.</span>
          </div>
          <div>
            <FileClock size={20} aria-hidden />
            <span>The admin UI shows memory files, revisions, and access logs.</span>
          </div>
          <div>
            <FileClock size={20} aria-hidden />
            <span>Your AI product can use TypeScript, Python, REST, or MCP against the same service.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
