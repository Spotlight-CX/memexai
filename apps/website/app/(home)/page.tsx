import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Database,
  FileClock,
  GitPullRequest,
  Network,
  Search,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const features = [
  {
    icon: Database,
    title: 'Postgres as memory',
    text: 'Store durable agent memory as scoped files in ordinary tables, with no vector database required for the core loop.',
  },
  {
    icon: FileClock,
    title: 'Auditable by default',
    text: 'Every write creates a revision and every access leaves a lightweight trail for debugging agent behavior.',
  },
  {
    icon: ShieldCheck,
    title: 'Scoped paths',
    text: 'Agents see virtual paths like user/profile.md while MemexAI enforces user isolation and shared read-only context.',
  },
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-inner">
          <div>
            <div className="eyebrow">
              <Database size={15} aria-hidden />
              Postgres-backed agent memory
            </div>
            <h1>Persistent memory for AI agents, backed by Postgres.</h1>
            <p className="hero-copy">
              MemexAI gives agents a small, durable memory surface and gives humans a real system of record: files,
              search, revisions, access logs, and an admin UI.
            </p>
            <div className="hero-actions">
              <Link className="site-button site-button-primary" href="/docs">
                <BookOpen size={17} aria-hidden />
                Get started
                <ArrowRight size={17} aria-hidden />
              </Link>
              <a className="site-button site-button-secondary" href="https://github.com/soorajsanker/memexai">
                <GitPullRequest size={17} aria-hidden />
                GitHub
              </a>
            </div>
          </div>

          <div className="hero-visual" aria-label="MemexAI product flow">
            <div className="terminal">
              <div className="terminal-header">
                <span>agent.ts</span>
                <span>memory_memorize</span>
              </div>
              <div className="terminal-body">
                <div>
                  <span className="dim">const</span> memory = memex.forUser({'{'} userId:{' '}
                  <span className="accent">&quot;user_123&quot;</span> {'}'})
                </div>
                <br />
                <div>
                  <span className="dim">await</span> memory.memorize(
                </div>
                <div>
                  &nbsp;&nbsp;<span className="accent">&quot;Prefers quiet neighborhoods near good schools.&quot;</span>
                </div>
                <div>)</div>
                <br />
                <div className="dim"># writes user/profile.md</div>
                <div className="dim"># updates user/index.md</div>
                <div className="dim"># records revision and access log</div>
              </div>
            </div>

            <div className="memory-plane">
              <div className="memory-plane-header">
                <span>Memory files</span>
                <span>Postgres</span>
              </div>
              <div className="memory-file">
                <span className="memory-path">user/profile.md</span>
                <span className="memory-meta">updated</span>
              </div>
              <div className="memory-file">
                <span className="memory-path">user/index.md</span>
                <span className="memory-meta">catalog</span>
              </div>
              <div className="memory-file">
                <span className="memory-path">shared/policy.md</span>
                <span className="memory-meta">read-only</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Why MemexAI</div>
        <h2>Agent memory should be inspectable, scoped, and boring to operate.</h2>
        <p className="section-lede">
          Most memory systems optimize for retrieving old chat chunks. MemexAI focuses on the smaller working set an
          agent should actually remember: durable facts, preferences, timelines, decisions, and source-backed updates.
        </p>
        <div className="feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div className="feature" key={feature.title}>
                <Icon size={24} aria-hidden />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Integration paths</div>
        <h2>Start with two tools. Drop down to files when you need control.</h2>
        <div className="split">
          <div className="path-panel">
            <Boxes size={24} aria-hidden />
            <h3>Agentic tools</h3>
            <p>Give the model memory_memorize and memory_search; MemexAI handles the file bookkeeping.</p>
            <pre>{`const tools = memory.createAgenticToolset()\n// memory_memorize, memory_search`}</pre>
          </div>
          <div className="path-panel">
            <Terminal size={24} aria-hidden />
            <h3>Raw file tools</h3>
            <p>Use explicit file operations for deterministic writes, custom extraction, or admin workflows.</p>
            <pre>{`const tools = memory.createRawToolset()\n// list, read, write, patch, smart_read`}</pre>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Transport</div>
        <h2>Use the service, direct Postgres, or MCP.</h2>
        <div className="feature-grid">
          <div className="feature">
            <Network size={24} aria-hidden />
            <h3>HTTP service</h3>
            <p>Run the Docker service for team deployments where apps should not hold database credentials.</p>
          </div>
          <div className="feature">
            <Database size={24} aria-hidden />
            <h3>Direct mode</h3>
            <p>Use @memexai/core or the Python SDK when your process already owns Postgres access.</p>
          </div>
          <div className="feature">
            <Search size={24} aria-hidden />
            <h3>MCP clients</h3>
            <p>Expose the same tool engine over SSE or stdio for clients that speak Model Context Protocol.</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="section">
          <div className="section-kicker">Launch path</div>
          <h2>Build memory your agents and your team can both understand.</h2>
          <p className="section-lede">
            Start with Docker service mode, inspect writes in the admin UI, then choose direct Postgres or MCP when
            your integration needs it.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs">
              <BookOpen size={17} aria-hidden />
              View docs
            </Link>
            <Link className="site-button site-button-secondary" href="/docs/quickstart/docker-service">
              <ArrowRight size={17} aria-hidden />
              Docker quickstart
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
