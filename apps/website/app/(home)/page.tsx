import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Calendar,
  CheckCircle,
  Database,
  FileClock,
  GitPullRequest,
  ListChecks,
  Network,
  Search,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { Reveal } from '../../components/reveal';
import { getFounderCallUrl } from '../../lib/links';

const features = [
  {
    icon: Database,
    title: 'Memory as files',
    text: 'Durable facts live in scoped Markdown-like files that feed the next prompt block. Agents use them. Humans can inspect and fix them.',
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
  {
    icon: Network,
    title: 'Collective memory when you want it',
    text: 'Keep shared/ read-only by default, or opt into shared writable mode so trusted agents can grow project canon, policies, and team workflows together.',
  },
  {
    icon: ListChecks,
    title: 'The memorize tool is opinionated',
    text: 'The common failure is agents writing task context into durable memory because the write tool is available. The memorize tool decides what is worth keeping — scoped paths enforce the rest.',
  },
];

const loop = [
  'Conversation happens',
  'Agent writes only durable memory',
  'Prompt block injects context',
  'Next response changes',
  'Humans inspect why',
];

export default function HomePage() {
  const founderCallUrl = getFounderCallUrl();

  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-inner">
          <div>
            <div className="eyebrow">
              <Database size={15} aria-hidden />
              Make memory a product surface, not a prompt secret
            </div>
            <h1>When your AI gets a user wrong, you can fix it.</h1>
            <p className="hero-copy">
              MemexAI stores what your AI remembers as Markdown files in your Postgres. Wrong fact? Edit the line. The
              next response changes. No black box. No re-indexing.
            </p>
            <div className="hero-actions">
              <Link className="site-button site-button-primary" href="/docs/quickstart/docker-service" data-analytics-event="cta_clicked" data-analytics-label="home_start_with_docker">
                <BookOpen size={17} aria-hidden />
                Try the 90-second proof
                <ArrowRight size={17} aria-hidden />
              </Link>
              <a className="site-button site-button-secondary" href="https://github.com/Spotlight-CX/memexai" data-analytics-event="cta_clicked" data-analytics-label="home_github">
                <GitPullRequest size={17} aria-hidden />
                GitHub
              </a>
            </div>
          </div>

          <div className="hero-visual" aria-label="MemexAI product flow">
            <div className="terminal">
              <div className="terminal-header">
                <span>agent.ts</span>
                <span>getSystemPrompt</span>
              </div>
              <div className="terminal-body">
                <div style={{'--i': 0} as React.CSSProperties}>
                  <span className="dim">const</span> memory = memex.forUser({'{'} userId:{' '}
                  <span className="accent">&quot;user_123&quot;</span> {'}'})
                </div>
                <br />
                <div style={{'--i': 1} as React.CSSProperties}>
                  <span className="dim">const</span> system = <span className="dim">await</span> memory.getSystemPrompt(...)
                </div>
                <div style={{'--i': 2} as React.CSSProperties}>
                  <span className="dim">await</span> memory.memorize(
                </div>
                <div style={{'--i': 3} as React.CSSProperties}>
                  &nbsp;&nbsp;<span className="accent">&quot;Prefers quiet neighborhoods near good schools.&quot;</span>
                </div>
                <div style={{'--i': 4} as React.CSSProperties}>)</div>
                <br />
                <div className="dim" style={{'--i': 5} as React.CSSProperties}># user returns next session</div>
                <div className="dim" style={{'--i': 6} as React.CSSProperties}># system prompt includes MemexAI memory</div>
                <div className="dim" style={{'--i': 7} as React.CSSProperties}># answer is personalized from turn one</div>
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
                <span className="memory-meta">global</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <Reveal>
          <div className="section-kicker">Is this for you?</div>
          <h2>You need this if any of these are true.</h2>
        </Reveal>
        <Reveal stagger className="for-who-list">
          <div className="for-who-row">
            <CheckCircle size={20} aria-hidden />
            <span>You&apos;ve shipped an AI product that talks to users across sessions</span>
          </div>
          <div className="for-who-row">
            <CheckCircle size={20} aria-hidden />
            <span>Users have complained that &quot;the AI forgot what I told it&quot;</span>
          </div>
          <div className="for-who-row">
            <CheckCircle size={20} aria-hidden />
            <span>You can&apos;t explain why the AI answered differently yesterday</span>
          </div>
          <div className="for-who-row">
            <CheckCircle size={20} aria-hidden />
            <span>Your team needs to correct a wrong fact the agent is carrying</span>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <div className="section-kicker">Coding agent setup</div>
          <h2>Give your coding agent one public setup file.</h2>
          <p className="section-lede">
            MemexAI ships an agent-readable onboarding guide at <code>memexai.space/setup.md</code>. Paste this command
            into your coding agent and let it inspect your app, choose the right SDK adapter, wire memory tools, and run
            a real two-turn proof: write memory, inject context, and verify the next answer changes.
          </p>
          <div className="agent-command-panel" aria-label="Coding agent setup command">
            <div className="agent-command-header">
              <span>Copy into your coding agent</span>
              <Terminal size={16} aria-hidden />
            </div>
            <pre>Setup MemexAI by following https://memexai.space/setup.md</pre>
          </div>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/quickstart/agent-onboarding" data-analytics-event="cta_clicked" data-analytics-label="home_agent_onboarding">
              Read agent onboarding
              <ArrowRight size={17} aria-hidden />
            </Link>
            <a className="site-button site-button-secondary" href="https://memexai.space/setup.md" data-analytics-event="cta_clicked" data-analytics-label="home_setup_md">
              Open setup.md
            </a>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <div className="section-kicker">Why AI products churn users</div>
          <h2>The AI starts fresh every session. Users re-explain everything. Eventually they stop.</h2>
          <p className="section-lede">
            Not because your product lacks features. Because the AI doesn&apos;t know who they are. MemexAI maintains the
            memory your AI should carry forward — preferences, friction points, identity signals — and injects it into
            the next response across sessions, models, and devices.
          </p>
        </Reveal>
        <Reveal stagger className="comparison">
          <div className="comparison-panel muted-panel">
            <h3>Without MemexAI</h3>
            <p>
              User returns. AI starts fresh. User re-explains preferences, situation, goals. Trust drops when the product
              keeps starting from zero.
            </p>
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
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <div className="section-kicker">The bet</div>
          <h2>Most memory systems retrieve the past. MemexAI maintains what should survive.</h2>
          <p className="section-lede">
            Raw transcripts can live in your app, warehouse, or audit store. MemexAI owns the smaller working set your
            agent should actually use later: preferences, commitments, decisions, timelines, project notes, and
            source-backed updates.
          </p>
        </Reveal>
        <Reveal stagger className="memory-loop" aria-label="MemexAI memory loop">
          {loop.map((item, index) => (
            <div className="loop-step" key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item}</strong>
            </div>
          ))}
        </Reveal>
      </section>

      <section className="section contrast-section">
        <Reveal>
          <div className="section-kicker">Collective memory</div>
          <h2>Your team should not teach the same agent the same lesson twice.</h2>
          <p className="section-lede">
            MemexAI now supports opt-in shared writable memory. Personal facts stay in <code>user/**</code>, while
            trusted deployments can let agents patch <code>shared/**</code> with durable project canon, policy updates,
            style guides, and workflow lessons that help every collaborator later.
          </p>
        </Reveal>
        <Reveal stagger className="comparison">
          <div className="comparison-panel muted-panel">
            <h3>Default safe</h3>
            <p>
              Agents can read shared memory but write only to user memory. A shared write without the flag fails with{' '}
              <code>READ_ONLY_MOUNT</code>.
            </p>
            <pre>{`user/profile.md      # writable\nshared/policy.md     # read-only`}</pre>
          </div>
          <div className="comparison-panel strong-panel">
            <h3>Opt-in collaborative</h3>
            <p>
              Set <code>MEMEX_SHARED_WRITE_MODE=rw</code> and the prompt, tool descriptions, and runtime validator agree
              that <code>shared/**</code> can be patched.
            </p>
            <pre>{`shared/screenplay-canon.md\nshared/style-guide.md\nshared/continuity-log.md`}</pre>
          </div>
        </Reveal>
      </section>

      <section className="section contrast-section">
        <Reveal>
          <div className="section-kicker">The difference</div>
          <h2>RAG over transcripts is useful. It is not the same as durable memory.</h2>
        </Reveal>
        <Reveal stagger className="comparison">
          <div className="comparison-panel muted-panel">
            <h3>Chat-log retrieval</h3>
            <p>Capture conversations, retrieve similar fragments, and hope the right old detail appears.</p>
            <pre>{`store every message\n→ embed chunks\n→ retrieve old text\n→ answer from fragments`}</pre>
          </div>
          <div className="comparison-panel strong-panel">
            <h3>MemexAI</h3>
            <p>Let the agent write durable facts, inject the right context, and leave humans a record they can inspect.</p>
            <pre>{`observe a session\n→ write durable memory\n→ inject prompt context\n→ answer from the record`}</pre>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
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
        </Reveal>
      </section>

      <section className="section contrast-section">
        <Reveal>
          <div className="section-kicker">Deep content</div>
          <h2>Long-horizon agents need memory you can inspect.</h2>
          <p className="section-lede">
            The research direction is clear: agents need durable state across sessions, and memory affects behavior as
            much as prompt wording. These essays lay out the practical implications for product teams.
          </p>
        </Reveal>
        <Reveal stagger className="feature-grid two-up-grid">
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
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <div className="section-kicker">What stays simple</div>
          <h2>A memory system should be legible before it is clever.</h2>
          <p className="section-lede">
            MemexAI is deliberately conservative: prompt-block injection, Postgres, files, revisions, access logs, and a
            small set of tools. The point is not to ship every memory feature. The point is to make memory dependable.
          </p>
        </Reveal>
        <Reveal stagger className="feature-grid">
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
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <div className="section-kicker">Trust surface</div>
          <h2>If a memory is wrong, you should be able to open it and fix it.</h2>
          <p className="section-lede">
            Memory is not just storage. It is behavioral context with an operational record. The admin UI shows what was
            remembered, when it changed, who touched it, and which reads happened later.
          </p>
          <div className="correction-diff" aria-label="Memory file correction example">
            <div className="correction-panel correction-panel-before">
              <div className="correction-panel-header">
                <span className="correction-panel-label">Before correction</span>
                <span className="correction-panel-filename">user/profile.md</span>
              </div>
              <pre className="correction-code">
                <div className="correction-line">location: Bangalore</div>
                <div className="correction-line">moved_from: null</div>
              </pre>
            </div>
            <div className="correction-panel correction-panel-after">
              <div className="correction-panel-header">
                <span className="correction-panel-label">After correction</span>
                <span className="correction-panel-filename">user/profile.md</span>
              </div>
              <pre className="correction-code">
                <div className="correction-line correction-line-added">
                  <span className="correction-marker">+</span>location: Mumbai
                </div>
                <div className="correction-line correction-line-added">
                  <span className="correction-marker">+</span>moved_from: Bangalore
                </div>
              </pre>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <div className="section-kicker">Integration paths</div>
          <h2>Start with two tools. Drop down to files when control matters.</h2>
        </Reveal>
        <Reveal stagger className="split">
          <div className="path-panel">
            <Boxes size={24} aria-hidden />
            <h3>Agentic tools</h3>
            <p>Give the model the prompt block plus `memory_memorize` and `memory_search`; MemexAI handles the file bookkeeping.</p>
            <pre>{`const system = await memory.getSystemPrompt(...)\nconst tools = memory.createAgenticToolset()`}</pre>
          </div>
          <div className="path-panel">
            <Terminal size={24} aria-hidden />
            <h3>Raw file tools</h3>
            <p>Use explicit file operations for deterministic writes, custom extraction, and admin workflows.</p>
            <pre>{`const tools = memory.createRawToolset()\n// list, read, write, patch, smart_read`}</pre>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <div className="section-kicker">Transport</div>
          <h2>Use the service, direct Postgres, or MCP.</h2>
        </Reveal>
        <Reveal stagger className="feature-grid">
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
        </Reveal>
      </section>

      <section className="cta-band">
        <div className="section">
          <Reveal>
            <div className="section-kicker">Build the record</div>
            <h2>Give your agent memory your team can trust.</h2>
            <p className="section-lede">
              Drop MemexAI into your stack with MCP, Python, TypeScript, or standard Postgres. Start with the simple loop:
              store memory, inject context, verify the next answer, and inspect why.
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
                href={founderCallUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-analytics-event="cta_clicked"
                data-analytics-label="home_talk_to_us_footer"
              >
                <Calendar size={17} aria-hidden />
                Talk to us
              </a>
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
          </Reveal>
        </div>
      </section>
    </main>
  );
}
