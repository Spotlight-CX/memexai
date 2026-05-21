import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Database,
  Eye,
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
    title: 'The file system abstraction',
    text: 'Store facts as explicit markdown files. LLMs know exactly how to read them, and you don’t need a vector DB for your core loop.',
  },
  {
    icon: FileClock,
    title: "Never wonder 'why did it do that?'",
    text: 'Every read leaves an access log. Every write creates a revision. Full traceability for agent behavior out of the box.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & multi-tenant by design',
    text: 'Agents only see virtual paths like user/profile.md. MemexAI strictly enforces tenant isolation under the hood.',
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
              The file system abstraction for agent memory
            </div>
            <h1>Agent memory you can actually inspect and trust.</h1>
            <p className="hero-copy">
              Stop dumping chat logs into vector databases. MemexAI gives your agents a scoped file system backed by
              Postgres—creating a durable, auditable system of record that humans can read and edit.
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
        <div className="section-kicker">Human in the loop</div>
        <h2>Memory isn&apos;t just for agents. It&apos;s for your team, too.</h2>
        <p className="section-lede">
          When an agent gets a fact wrong, you shouldn&apos;t have to delete embeddings. With MemexAI&apos;s Admin UI,
          your team can review revisions, audit access logs, and manually edit a user&apos;s memory files to fix
          errors directly.
        </p>
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
            <h3>Containerized service</h3>
            <p>Run MemexAI as a separate service, then connect with the TypeScript SDK, Python SDK, or MCP.</p>
          </div>
          <div className="feature">
            <Database size={24} aria-hidden />
            <h3>Advanced direct runtime</h3>
            <p>Use JavaScript or Python directly with Postgres only when your app should own database credentials.</p>
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
          <div className="section-kicker">Ready to launch</div>
          <h2>Ready to move past black-box memory?</h2>
          <p className="section-lede">
            Drop MemexAI into your stack with MCP, our Python/TS SDKs, or standard Postgres. Start building agents with
            a memory system you can actually debug.
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
