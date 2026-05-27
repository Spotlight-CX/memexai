import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Database,
  Eye,
  FileClock,
  GitPullRequest,
  ListChecks,
  Network,
  Search,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const features = [
  {
    icon: Database,
    title: 'Memory as files',
    text: 'Durable facts live in scoped Markdown-like files. Agents can read them. Humans can inspect and fix them.',
  },
  {
    icon: FileClock,
    title: 'Every change has a trail',
    text: 'Reads create access logs. Writes create revisions. Memory stops being a mystery blob.',
  },
  {
    icon: ShieldCheck,
    title: 'Scoped by default',
    text: 'Agents work with virtual paths like user/profile.md and shared/policy.md while MemexAI enforces isolation.',
  },
];

const loop = [
  'Conversation happens',
  'Agent writes only durable memory',
  'Files stay inspectable',
  'Search recalls targeted records later',
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-inner">
          <div>
            <div className="eyebrow">
              <Database size={15} aria-hidden />
              Persistent user memory for AI products
            </div>
            <h1>Your users shouldn&apos;t have to re-introduce themselves every session.</h1>
            <p className="hero-copy">
              MemexAI gives your AI product taste memory — a persistent, inspectable model of who each user is. No GPU,
              no vector store. Structured files in Postgres your team can read, edit, and trust.
            </p>
            <div className="hero-actions">
              <Link className="site-button site-button-primary" href="/docs" data-analytics-event="cta_clicked" data-analytics-label="home_start_with_docker">
                <BookOpen size={17} aria-hidden />
                Start with Docker
                <ArrowRight size={17} aria-hidden />
              </Link>
              <a className="site-button site-button-secondary" href="https://github.com/Spotlight-CX/memexai" data-analytics-event="cta_clicked" data-analytics-label="home_github">
                <GitPullRequest size={17} aria-hidden />
                GitHub
              </a>
              <Link className="site-button site-button-secondary" href="/compare" data-analytics-event="cta_clicked" data-analytics-label="home_compare">
                Compare
              </Link>
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
                <div className="dim"># user returns next session</div>
                <div className="dim"># AI already knows: preferences,</div>
                <div className="dim"># friction, goals — no re-intro needed</div>
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
        <div className="section-kicker">Why AI products churn users</div>
        <h2>The AI starts fresh every session. Users re-explain everything. Eventually they stop.</h2>
        <p className="section-lede">
          Not because your product lacks features. Because the AI doesn&apos;t know who they are. MemexAI maintains the
          memory your AI should carry forward — preferences, friction points, identity signals — across sessions, models,
          and devices.
        </p>
        <div className="comparison">
          <div className="comparison-panel muted-panel">
            <h3>Without MemexAI</h3>
            <p>User returns. AI starts fresh. User re-explains preferences, situation, goals. Day 7 retention drops.</p>
            <pre>{`session 1: user explains context\nsession 2: AI starts fresh\nsession 3: user explains again\nday 7: user stops coming back`}</pre>
          </div>
          <div className="comparison-panel strong-panel">
            <h3>With MemexAI</h3>
            <p>
              User returns. AI already knows their taste, friction, and goals. The product feels like it genuinely knows
              them.
            </p>
            <pre>{`session 1: AI learns, writes memory\nsession 2: AI reads memory\nsession 3: personalized from first message\nday 7: user feels understood`}</pre>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">The bet</div>
        <h2>Most memory systems retrieve the past. MemexAI maintains what should survive.</h2>
        <p className="section-lede">
          Raw transcripts can live in your app, warehouse, or audit store. MemexAI owns the smaller working set your
          agent should actually carry forward: preferences, commitments, decisions, timelines, project notes, and
          source-backed updates.
        </p>
        <div className="memory-loop" aria-label="MemexAI memory loop">
          {loop.map((item, index) => (
            <div className="loop-step" key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">The difference</div>
        <h2>RAG over transcripts is useful. It is not the same as durable memory.</h2>
        <div className="comparison">
          <div className="comparison-panel muted-panel">
            <h3>Chat-log retrieval</h3>
            <p>Store everything, embed chunks, retrieve similar fragments, hope the right old detail appears.</p>
            <pre>{`store every message\n→ embed chunks\n→ retrieve old text\n→ answer from fragments`}</pre>
          </div>
          <div className="comparison-panel strong-panel">
            <h3>MemexAI</h3>
            <p>Let the agent write only durable facts into files that humans can inspect, edit, and audit.</p>
            <pre>{`observe a session\n→ write durable memory\n→ maintain files\n→ recall targeted records`}</pre>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Evaluate</div>
        <h2>Choosing between MemexAI, Mem0, Zep, or a vector database?</h2>
        <p className="section-lede">
          The important question is whether you need search over old text or an inspectable user memory record your
          team can operate. The comparison page lays out the tradeoff directly.
        </p>
        <div className="hero-actions">
          <Link className="site-button site-button-primary" href="/compare" data-analytics-event="cta_clicked" data-analytics-label="home_compare_memory_approaches">
            Compare memory approaches
            <ArrowRight size={17} aria-hidden />
          </Link>
          <Link className="site-button site-button-secondary" href="/walkthroughs" data-analytics-event="cta_clicked" data-analytics-label="home_walkthrough_queue">
            Walkthrough queue
          </Link>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Deep content</div>
        <h2>Long-horizon agents need memory you can inspect.</h2>
        <p className="section-lede">
          The research direction is clear: agents need durable state across sessions, and memory affects behavior as
          much as prompt wording. These essays lay out the practical implications for product teams.
        </p>
        <div className="feature-grid two-up-grid">
          <Link className="feature link-card article-card" href="/blog/long-horizon-agents-need-memory">
            <FileClock size={24} aria-hidden />
            <span className="small-meta">Agent architecture</span>
            <h3>Long-horizon agents need memory for trajectories</h3>
            <p>Why memory should preserve project state, corrections, policies, and progress across sessions.</p>
          </Link>
          <Link className="feature link-card article-card" href="/blog/stop-running-evals-only-on-prompts">
            <ListChecks size={24} aria-hidden />
            <span className="small-meta">Memory evals</span>
            <h3>Stop running evals only on prompts</h3>
            <p>How shared memory and user records become part of the behavior surface you need to test.</p>
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What stays simple</div>
        <h2>A memory system should be legible before it is clever.</h2>
        <p className="section-lede">
          MemexAI is deliberately conservative: Postgres, files, revisions, access logs, and a small set of tools. The
          point is not to ship every memory feature. The point is to make memory dependable.
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
        <div className="section-kicker">Trust surface</div>
        <h2>If a memory is wrong, you should be able to open it and fix it.</h2>
        <p className="section-lede">
          Memory is not just model context. It is an operational record. The admin UI shows what was remembered, when it
          changed, who touched it, and which reads happened later.
        </p>
        <div className="trust-list">
          <div>
            <Eye size={20} aria-hidden />
            <span>Inspect memory files directly</span>
          </div>
          <div>
            <FileClock size={20} aria-hidden />
            <span>Review revisions and access logs</span>
          </div>
          <div>
            <ListChecks size={20} aria-hidden />
            <span>Correct records without rebuilding an index</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Integration paths</div>
        <h2>Start with two tools. Drop down to files when control matters.</h2>
        <div className="split">
          <div className="path-panel">
            <Boxes size={24} aria-hidden />
            <h3>Agentic tools</h3>
            <p>Give the model `memory_memorize` and `memory_search`; MemexAI handles the file bookkeeping.</p>
            <pre>{`const tools = memory.createAgenticToolset()\n// memory_memorize, memory_search`}</pre>
          </div>
          <div className="path-panel">
            <Terminal size={24} aria-hidden />
            <h3>Raw file tools</h3>
            <p>Use explicit file operations for deterministic writes, custom extraction, and admin workflows.</p>
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
          <div className="section-kicker">Build the record</div>
          <h2>Give your agent memory your team can trust.</h2>
          <p className="section-lede">
            Drop MemexAI into your stack with MCP, Python, TypeScript, or standard Postgres. Start with the simple loop:
            remember durable facts, inspect the files, search them later.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs" data-analytics-event="cta_clicked" data-analytics-label="home_view_docs">
              <BookOpen size={17} aria-hidden />
              View docs
            </Link>
            <Link className="site-button site-button-secondary" href="/docs/quickstart/docker-service" data-analytics-event="cta_clicked" data-analytics-label="home_docker_quickstart">
              <ArrowRight size={17} aria-hidden />
              Docker quickstart
            </Link>
            <Link className="site-button site-button-secondary" href="/roadmap" data-analytics-event="cta_clicked" data-analytics-label="home_roadmap">
              Roadmap
            </Link>
            <a
              className="site-button site-button-secondary"
              href="https://join.slack.com/t/memexaispace/shared_invite/zt-3yy24alf6-t1wRQsErf09JViHww_qlGw"
              target="_blank"
              rel="noopener noreferrer"
              data-analytics-event="cta_clicked"
              data-analytics-label="home_slack"
            >
              Community / Support
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
