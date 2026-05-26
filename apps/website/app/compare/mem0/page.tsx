import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Database, FileText, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI vs Mem0',
  description:
    'Compare MemexAI and Mem0 for AI products choosing between extracted memory retrieval and inspectable Postgres memory files.',
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
            Mem0 is useful when you want extracted memories, consolidation, and retrieval. MemexAI is built for AI
            products that need a human-readable user memory record in Postgres, with revisions, access logs, and admin
            inspection.
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
              Scoped Markdown-like files in Postgres. Agents use memory_memorize and memory_search, while your team can
              inspect and correct the underlying files, review revisions, and see later reads in access logs.
            </p>
          </div>
          <div className="path-panel">
            <Database size={24} aria-hidden />
            <h3>Mem0</h3>
            <p>
              The Mem0 paper frames its architecture around dynamically extracting, consolidating, and retrieving
              salient information from conversations. That can work well for fact recall and personalization, but it is
              a different operating model than directly edited memory files.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Technical tradeoff</div>
        <h2>Extraction-first memory is convenient. File-first memory is easier to inspect.</h2>
        <div className="compare-table" role="table" aria-label="MemexAI and Mem0 technical comparison">
          <div className="compare-row compare-head two-col-row" role="row">
            <div role="columnheader">Question</div>
            <div role="columnheader">MemexAI</div>
            <div role="columnheader">Mem0</div>
          </div>
          {[
            ['What is the unit of memory?', 'A path-addressed file such as user/profile.md', 'Extracted memory items and retrieval results'],
            ['How does a human debug it?', 'Open the file, inspect revisions, review reads', 'Inspect via API/dashboard/logs depending on setup'],
            ['What should it store?', 'Durable facts, corrections, policies, project state', 'Salient conversational facts for later recall'],
            ['Where does it fit best?', 'Products where support, ops, or users may need correction', 'Apps that want a managed memory layer quickly'],
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

      <section className="section">
        <div className="section-kicker">Source note</div>
        <h2>This comparison is based on the public technical frame, not a strawman.</h2>
        <p className="section-lede">
          Mem0&apos;s own paper describes a memory-centric architecture for scalable long-term memory through dynamic
          extraction, consolidation, and retrieval. MemexAI&apos;s differentiation is not that retrieval is bad; it is
          that some products need the remembered record to be directly editable and auditable.
        </p>
        <div className="source-list">
          <a href="https://arxiv.org/abs/2504.19413" target="_blank" rel="noopener noreferrer">
            Mem0 paper
          </a>
          <a href="https://docs.mem0.ai/" target="_blank" rel="noopener noreferrer">
            Mem0 docs
          </a>
          <Link href="/blog/stop-running-evals-only-on-prompts">Memory-aware evals</Link>
        </div>
      </section>
    </main>
  );
}
