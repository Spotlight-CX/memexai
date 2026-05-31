import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Database,
  FileClock,
  GitCompareArrows,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Why we shipped Dreaming for AI memory',
  description:
    'A research and engineering essay on MemexAI Background Dreaming, Anthropic Managed Agents Dreams, and why durable agent memory needs inspectable consolidation.',
  alternates: {
    canonical: '/blog/why-we-shipped-dreaming-for-ai-memory',
  },
  openGraph: {
    title: 'Why we shipped Dreaming for AI memory',
    description:
      'Why multi-session agent memory needs background consolidation, and how MemexAI Dreaming differs from Anthropic Managed Agents Dreams.',
    url: 'https://memexai.space/blog/why-we-shipped-dreaming-for-ai-memory',
  },
};

const sources = [
  ['Anthropic Dreams docs', 'https://platform.claude.com/docs/en/managed-agents/dreams'],
  ['Anthropic Managed Agents memory', 'https://claude.com/blog/claude-managed-agents-memory'],
  ['Anthropic Managed Agents announcement', 'https://claude.com/blog/new-in-claude-managed-agents'],
  ['Managed Agents engineering post', 'https://www.anthropic.com/engineering/managed-agents'],
  ['Generative Agents', 'https://arxiv.org/abs/2304.03442'],
  ['Reflexion', 'https://arxiv.org/abs/2303.11366'],
  ['MemGPT', 'https://arxiv.org/abs/2310.08560'],
];

const evidence = [
  {
    value: '1-100',
    label: 'sessions',
    detail: 'Anthropic Dreams can take a memory store plus 1 to 100 past sessions as input during the research preview.',
  },
  {
    value: '97%',
    label: 'fewer first-pass errors',
    detail:
      'Anthropic reports Rakuten used Managed Agents memory to reduce first-pass errors within workspace-scoped boundaries.',
  },
  {
    value: '30%',
    label: 'faster verification',
    detail:
      'Anthropic reports Wisedocs sped document verification by remembering recurring document issues across sessions.',
  },
  {
    value: '~6x',
    label: 'completion-rate lift',
    detail:
      'Anthropic reports Harvey saw a roughly 6x completion-rate improvement in tests using Managed Agents with dreaming.',
  },
];

const comparison = [
  {
    label: 'Runtime',
    anthropic: 'Hosted Claude Managed Agents platform.',
    memex: 'Self-hostable memory infrastructure for your app, service, or framework.',
  },
  {
    label: 'Input',
    anthropic: 'A memory store plus selected past session transcripts.',
    memex: 'Durable MemexAI memory files; logs and dream logs are excluded.',
  },
  {
    label: 'Output model',
    anthropic: 'Produces a separate output memory store that can be reviewed or discarded.',
    memex: 'Writes bounded patches through normal memory tools, creating revisions and access logs.',
  },
  {
    label: 'Primary goal',
    anthropic: 'Help managed agents learn patterns across sessions and teams.',
    memex: 'Keep app-owned memory clean, readable, and inspectable over time.',
  },
];

const consolidationSteps = [
  'Agent writes local memory during work',
  'Memory accumulates duplicates, fragments, and corrections',
  'Background consolidation runs after quiet time',
  'Durable memory becomes easier to trust next session',
];

const memexLoop = [
  'select changed users',
  'wait for quiet memory',
  'skip logs',
  'run bounded dream agent',
  'patch normal files',
  'record revisions',
];

export default function DreamingMemoryBlogPage() {
  return (
    <main className="site-shell">
      <article>
        <section className="page-hero">
          <div className="section">
            <div className="eyebrow">
              <Brain size={15} aria-hidden />
              Research note
            </div>
            <h1>Why we shipped Dreaming for AI memory.</h1>
            <p className="section-lede">
              Anthropic&apos;s Managed Agents Dreams are a strong signal: long-running agents need memory consolidation,
              not just memory storage. The same pressure shows up in shorter products too, as soon as users return
              across separate sessions. Here is the research thread, what happens to personalization when memory is
              never cleaned, and why MemexAI takes a different infrastructure path.
            </p>
          </div>
        </section>

        <section className="section article-layout">
          <div className="article-body">
            <p>
              Once agents work across sessions, memory cannot just accumulate. It needs to be curated, cleaned,
              corrected, and made usable again. That is the admission Anthropic made explicit in Managed Agents Dreams —
              and it is the right framing. Multi-session memory is not a storage problem. It is a maintenance problem.
            </p>

            <p>
              Anthropic has now made that idea explicit in Claude Managed Agents. Their Dreams feature lets Claude
              reflect on past sessions, deduplicate and reorganize memory, surface new insights, and produce a new
              memory store for review. That is a useful direction for the whole agent ecosystem. It says that memory
              consolidation is becoming a primitive, not a nice-to-have.
            </p>

            <p>
              MemexAI Dreaming comes from the same broad observation, but from a different product stance. We are not
              building a hosted agent runtime. We are building a memory layer that product teams can own: Postgres
              backed, inspectable, model-agnostic, and wired into the app where durable memory already has governance,
              consent, and operational consequences.
            </p>

            <div className="evidence-strip" aria-label="Signals that agent memory consolidation is becoming important">
              {evidence.map((item) => (
                <div key={item.value + item.label}>
                  <span>{item.value}</span>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
            <p className="small-meta">
              Figures above are Anthropic-reported customer and internal results. They are evidence that the category
              matters — not MemexAI benchmark claims.
            </p>

            <h2>The research thread</h2>
            <p>
              This idea has been circling in agent research for a while. Generative Agents used reflection to synthesize
              higher-level memories from lower-level observations, making agents more coherent over time. Reflexion
              showed that language agents can improve by writing verbal feedback about prior attempts. MemGPT framed
              memory as an operating-systems problem: the context window is limited, so agents need explicit memory
              tiers and movement between them.
            </p>

            <p>
              The common thread is not that agents should remember everything. It is that raw experience is too messy to
              reuse directly. Something has to decide what matters, what changed, what conflicts, and what should be
              carried forward.
            </p>

            <div className="flow-diagram" aria-label="Memory consolidation flow">
              {consolidationSteps.map((step, index) => (
                <div className="flow-step" key={step}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>

            <div className="article-callout">
              <FileClock size={22} aria-hidden />
              <p>
                Multi-session memory is not a pile of old text. It is a maintained working set that future agent
                sessions rely on.
              </p>
            </div>

            <h2>What Anthropic got right</h2>
            <p>
              Anthropic&apos;s Managed Agents memory is file-backed, permissioned, auditable, and programmatically
              controllable. That matters. Agents are already good at using files during serious work, so filesystem-like
              memory gives the model a familiar control surface instead of forcing every memory operation through opaque
              retrieval.
            </p>

            <p>
              Their Dreams design is also explicit about the maintenance problem. Managed agents write local,
              incremental memories as they work. Across sessions, that creates duplicates, contradictions, and stale
              entries. A dream reads a memory store and past sessions, then produces a reorganized output store. The
              input store is not modified, so the result can be inspected before it is adopted.
            </p>

            <p>
              I like this framing because it moves the industry away from the shallow version of AI memory: embed every
              conversation, retrieve some chunks, and call it personalization. The harder problem is not whether you can
              find an old fact. It is whether the durable memory state is still worth trusting.
            </p>

            <h2>Where MemexAI is different</h2>
            <p>
              MemexAI Dreaming is not a clone of Anthropic Dreams. It solves the same class of problem at a different
              layer of the stack.
            </p>

            <div className="swimlane-diagram" aria-label="Anthropic Dreams and MemexAI Dreaming comparison">
              <div>
                <h3>Anthropic Dreams</h3>
                <div className="diagram-chain">
                  <span>Managed Agents</span>
                  <span>memory store + sessions</span>
                  <span>dream job</span>
                  <span>separate output store</span>
                </div>
              </div>
              <div>
                <h3>MemexAI Dreaming</h3>
                <div className="diagram-chain">
                  <span>your app</span>
                  <span>Postgres memory files</span>
                  <span>bounded dream pass</span>
                  <span>revisioned patches</span>
                </div>
              </div>
            </div>

            <div className="numbered-grid">
              {comparison.map((item, index) => (
                <div key={item.label}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{item.label}</h3>
                  <p>
                    <strong>Anthropic:</strong> {item.anthropic}
                  </p>
                  <p>
                    <strong>MemexAI:</strong> {item.memex}
                  </p>
                </div>
              ))}
            </div>

            <p>
              The biggest philosophical difference is the input. Anthropic Dreams can mine selected session transcripts
              for patterns and insights. MemexAI Dreaming deliberately works on the durable memory files MemexAI already
              owns. It excludes <code>user/log.md</code>, <code>user/dream-log.md</code>, files ending in{' '}
              <code>-log.md</code>, and files ending in <code>.log</code>.
            </p>

            <p>
              That is a product decision. Raw transcripts are useful, but they are not the same thing as durable memory.
              In many products, transcripts include one-off debugging, accidental phrasing, sensitive context, or
              temporary exploration. MemexAI&apos;s first version of Dreaming is intentionally narrower: clean the memory
              record, do not mine the entire conversation archive.
            </p>

            <h2>Why we built it this way</h2>
            <p>
              MemexAI stores memory as scoped virtual files such as <code>user/profile.md</code> and{' '}
              <code>shared/company.md</code>. Agents can list, read, write, patch, and search those files. Humans can
              inspect them in the admin UI. Postgres stores the current file state, revisions, access logs, and runtime
              dream configuration.
            </p>

            <p>
              That shape gives us a simple rule for background consolidation: if a dream changes memory, it should go
              through the same write path as every other memory change. No hidden side channel. No privileged rewrite
              path. No separate store that operators have to reconcile manually.
            </p>

            <p>
              Dream writes use <code>memory_write</code> and <code>memory_patch</code>, create normal{' '}
              <code>mx_revision</code> rows, and appear in access logs with <code>actor = dream-agent</code>. Operators
              can inspect the before and after. If the dream agent finds nothing worth changing, it records zero files
              touched and does not add noise to <code>user/dream-log.md</code>.
            </p>

            <p>
              The rationale is less about being conservative for its own sake and more about preserving the difference
              between evidence and memory. Evidence can be messy: transcripts, tool traces, temporary notes, and failed
              attempts. Memory is the maintained record the next session will trust. Mixing those too early makes the
              agent feel smart in the short term and brittle in the long term.
            </p>

            <h2>The scheduler is part of the design</h2>
            <p>
              Dreaming is opt-in. When <code>MEMEX_DREAM_ENABLED=true</code>, the service starts a background scheduler,
              but the database <code>dream_enabled</code> key remains the runtime master switch. The loop only selects
              users with qualifying <code>user/</code> memory writes newer than their last dream run, waits for a quiet
              grace period, respects per-user pause flags, and enforces a write budget.
            </p>

            <p>
              Those details sound operational, but they are product decisions. A memory cleanup system that runs too
              eagerly can erase useful ambiguity. A system with no write budget can change too much state at once. A
              system with no per-user pause makes debugging and user-level opt-out harder than it needs to be.
            </p>

            <div className="loop-diagram" aria-label="MemexAI Dreaming scheduler loop">
              {memexLoop.map((step, index) => (
                <div key={step}>
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>

            <div className="article-callout">
              <ShieldCheck size={22} aria-hidden />
              <p>
                Background consolidation should be automatic enough to keep memory healthy, but controlled enough that
                operators can understand and stop it.
              </p>
            </div>

            <h2>The product reason</h2>
            <p>
              The deeper product bet is taste memory. For consumer AI products, the useful question is not simply
              whether the AI can retrieve something a user said. It is whether the product can maintain a useful model
              of the user: what they prefer, what they avoid, how they make decisions, what constraints matter, and what
              has changed over time.
            </p>

            <p>
              If that model gets noisier with every interaction, personalization eventually becomes a liability. The AI
              may technically remember more while feeling less trustworthy. That is why memory maintenance matters. A
              good memory layer should make the user record cleaner with use, not slowly turn it into a junk drawer.
            </p>

            <p>
              Any AI product with persistent user memory eventually needs a memory hygiene loop, because user trust
              depends on the quality of the maintained record, not the total volume of remembered text.
            </p>

            <h2>What shipped</h2>
            <p>
              The core design is now live: opt-in background scheduling with a quiet grace period, write budgets that
              cap how much a single dream pass can change, per-user pause controls, and full revision and access-log
              preservation through the normal memory write path. Dream writes are indistinguishable from agent writes in
              the audit trail — except the actor is <code>dream-agent</code>. If a dream run finds nothing worth
              changing, it records zero files touched and stays silent.
            </p>

            <p>
              Still ahead: source-aware consolidation, consent controls, conflict detection for context-dependent
              preferences, quality evals for dream runs, and policy hooks for sensitive domains. But this first version
              draws the line that matters — memory is product state, and background maintenance should be inspectable
              infrastructure, not a hidden rewrite.
            </p>

            <div className="hero-actions">
              <Link className="site-button site-button-primary" href="/docs/operations/dreaming">
                Read the operations guide
                <ArrowRight size={17} aria-hidden />
              </Link>
              <Link className="site-button site-button-secondary" href="/dreaming">
                See the product page
              </Link>
            </div>
          </div>

          <aside className="article-aside">
            <div className="source-panel">
              <BookOpen size={21} aria-hidden />
              <h2>Sources</h2>
              <ul>
                {sources.map(([label, href]) => (
                  <li key={href}>
                    <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="source-panel">
              <GitCompareArrows size={21} aria-hidden />
              <h2>Main contrast</h2>
              <p>
                Anthropic Dreams are a managed-agent capability. MemexAI Dreaming is app-owned memory infrastructure
                that keeps durable memory files clean inside your Postgres-backed system of record.
              </p>
            </div>
            <div className="source-panel">
              <Database size={21} aria-hidden />
              <h2>Core claim</h2>
              <p>
                Memory consolidation should not hide state. It should leave revisions, access logs, and operator
                controls behind.
              </p>
            </div>
            <div className="source-panel">
              <TrendingUp size={21} aria-hidden />
              <h2>Data note</h2>
              <p>
                External metrics in this essay are Anthropic-reported customer or internal results. They are evidence
                for the category, not MemexAI benchmark claims.
              </p>
            </div>
          </aside>
        </section>
      </article>
    </main>
  );
}
