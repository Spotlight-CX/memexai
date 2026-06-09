import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Cloud, Database, FileText, Network, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI vs Maximem',
  description:
    'Compare MemexAI and Maximem Synap for teams choosing between managed graph/vector memory and inspectable Postgres-native agent memory.',
  alternates: {
    canonical: '/compare/maximem',
  },
  openGraph: {
    title: 'MemexAI vs Maximem',
    description:
      'A practical comparison for teams choosing between Maximem Synap and open-source Postgres-native memory infrastructure.',
    url: 'https://memexai.space/compare/maximem',
  },
};

export default function MaximemComparePage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <Cloud size={15} aria-hidden />
            Maximem alternative
          </div>
          <h1>MemexAI vs Maximem for agent memory infrastructure.</h1>
          <p className="section-lede">
            Maximem Synap is a managed memory platform with graph retrieval, typed extraction, and benchmark-led
            positioning. MemexAI is the control-plane alternative for teams that want agent memory to live in their own
            Postgres, as inspectable files with revisions, access logs, admin correction workflows, and optional
            pgvector-backed hybrid search.
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
        <h2>Maximem manages the memory pipeline. MemexAI makes the memory record operable.</h2>
        <div className="split">
          <div className="path-panel">
            <FileText size={24} aria-hidden />
            <h3>MemexAI</h3>
            <p>
              Scoped Markdown-like files in Postgres. Agents can memorize and search, while your team can open the
              durable record, inspect revisions, review reads, and correct memory directly when product behavior depends
              on it.
            </p>
          </div>
          <div className="path-panel">
            <Network size={24} aria-hidden />
            <h3>Maximem Synap</h3>
            <p>
              Maximem Synap presents a managed memory layer that ingests conversations and documents, extracts typed
              memories, resolves entities, and retrieves context from managed vector and graph stores.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Technical tradeoff</div>
        <h2>Managed graph memory is powerful. Postgres-native memory is easier to own and debug.</h2>
        <div className="compare-table" role="table" aria-label="MemexAI and Maximem technical comparison">
          <div className="compare-row compare-head two-col-row" role="row">
            <div role="columnheader">Question</div>
            <div role="columnheader">MemexAI</div>
            <div role="columnheader">Maximem Synap</div>
          </div>
          {[
            ['Default architecture', 'Scoped memory files in your Postgres', 'Managed Synap Cloud pipeline with vector and graph stores'],
            ['Primary memory unit', 'Human-readable files such as user/profile.md and shared/policy.md', 'Typed extracted memories: facts, preferences, episodes, emotions, temporal events'],
            ['Retrieval model', 'BM25 fallback, optional pgvector hybrid search, and optional model-backed resolution over files', 'Fast vector retrieval or accurate vector + graph traversal with re-ranking'],
            ['Hosting model', 'Open-source Docker service or direct Postgres library by default', 'Cloud-first managed service; on-prem is positioned for Enterprise'],
            ['JavaScript fit', 'Native TypeScript SDK and core package', 'JavaScript wrapper requires a Python runtime according to public docs'],
            ['What does the public story emphasize?', 'Control, Postgres ownership, admin inspection, honest operability', 'Managed context pipeline, typed extraction, graph/vector retrieval, benchmark proof'],
            ['Human correction', 'Open, edit, and revision the memory record directly', 'Managed dashboard/API workflow over extracted memories'],
            ['Best fit', 'Teams that need owned, inspectable, self-hosted memory records', 'Teams that want a managed context pipeline with richer retrieval machinery'],
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
        <h2>Choose MemexAI when memory has to be owned product state.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>You want memory in the Postgres stack your team already operates.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>You need admins, support, or product teams to inspect and correct memory directly.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>You want self-hosting as the default path, not a custom enterprise deployment.</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Fair reading</div>
        <h2>Maximem is the stronger managed retrieval story. MemexAI is the stronger control story.</h2>
        <p className="section-lede">
          Based on Maximem&apos;s public positioning, Synap emphasizes managed graph traversal, entity resolution, typed
          extraction, compaction, and benchmark claims. MemexAI should not pretend to be a larger managed memory cloud.
          Its advantage is narrower and practical: the remembered record is directly visible, editable, revisioned, and
          stored in infrastructure your application owns. When semantic recall matters, MemexAI can add vector search
          inside Postgres instead of moving memory into a separate vector service.
        </p>
      </section>
    </main>
  );
}
