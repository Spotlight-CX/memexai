import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Database, FileClock, Network } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI vs Zep',
  description:
    'Compare MemexAI and Zep for teams choosing between temporal graph memory and inspectable Postgres memory files.',
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
            Zep is a strong fit when you want graph-oriented conversation memory and temporal relationships. MemexAI is
            the simpler path when your product needs inspectable user memory files, revision history, access logs, and a
            Postgres-native deployment.
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
              Zep&apos;s paper frames Graphiti as a temporally-aware knowledge graph that synthesizes conversational and
              business data while maintaining historical relationships.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Technical tradeoff</div>
        <h2>Graphs help when relationships are the product. Files help when the record must be obvious.</h2>
        <div className="compare-table" role="table" aria-label="MemexAI and Zep technical comparison">
          <div className="compare-row compare-head two-col-row" role="row">
            <div role="columnheader">Question</div>
            <div role="columnheader">MemexAI</div>
            <div role="columnheader">Zep</div>
          </div>
          {[
            ['What is the unit of memory?', 'A scoped file under user/ or shared/', 'Entities, relationships, episodes, and graph facts'],
            ['What is the strength?', 'Human-legible state and simple self-hosting', 'Temporal relationship modeling and graph retrieval'],
            ['What is the risk?', 'Files need curation and naming hygiene', 'Graph memory can add operational and debugging complexity'],
            ['Best fit', 'Product memory, policies, preferences, correction records', 'Conversation intelligence with rich entity relationships'],
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

      <section className="section">
        <div className="section-kicker">Source note</div>
        <h2>Zep and MemexAI optimize for different operating models.</h2>
        <p className="section-lede">
          Zep&apos;s public technical story is graph memory. MemexAI&apos;s story is memory that can be opened like a
          file, corrected like product data, and audited through revisions and access logs.
        </p>
        <div className="source-list">
          <a href="https://arxiv.org/abs/2501.13956" target="_blank" rel="noopener noreferrer">
            Zep paper
          </a>
          <a href="https://help.getzep.com/v2/memory" target="_blank" rel="noopener noreferrer">
            Zep memory docs
          </a>
          <Link href="/docs/concepts/shared-memory">Shared memory guide</Link>
        </div>
      </section>
    </main>
  );
}
