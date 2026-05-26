import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Database, FileText, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI vs Mem0',
  description:
    'Compare MemexAI and Mem0 for AI products that need persistent, inspectable user memory without adding vector infrastructure.',
  alternates: {
    canonical: '/compare/mem0',
  },
  openGraph: {
    title: 'MemexAI vs Mem0',
    description:
      'A practical comparison for teams choosing between inspectable Postgres memory files and embedding-oriented AI memory.',
    url: 'https://memexai.space/compare/mem0',
  },
};

export default function Mem0ComparePage() {
  return (
    <main className="site-shell">
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <Database size={15} aria-hidden />
            Mem0 alternative
          </div>
          <h1>MemexAI vs Mem0 for persistent user memory.</h1>
          <p className="section-lede">
            Mem0 is useful when you want extracted memories and retrieval. MemexAI is built for AI products that need a
            human-readable user memory record in Postgres, with revisions and admin inspection.
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
        <h2>Mem0 treats memory like extracted facts to retrieve. MemexAI treats memory like product data to operate.</h2>
        <div className="split">
          <div className="path-panel">
            <FileText size={24} aria-hidden />
            <h3>MemexAI</h3>
            <p>
              Scoped Markdown-like files in Postgres. Agents use `memory_memorize` and `memory_search`, while your team
              can inspect and correct the underlying files.
            </p>
          </div>
          <div className="path-panel">
            <Database size={24} aria-hidden />
            <h3>Mem0</h3>
            <p>
              Memory is optimized around extraction and retrieval. That can work well for fact recall, but the record is
              less directly editable as a product surface.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">When to choose MemexAI</div>
        <h2>Choose MemexAI when trust and editability matter as much as recall.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>You need self-hosted memory in the Postgres stack you already run.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>You want admins to inspect user memory without reverse-engineering embeddings.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>You need revision trails for debugging why the AI remembered something.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
