import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BookOpen, FileClock, GitBranch, Search } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Long-horizon agents need memory for trajectories',
  description:
    'A technical essay on why long-horizon agents need durable trajectory memory, not only larger context windows or prompt engineering.',
  alternates: {
    canonical: '/blog/long-horizon-agents-need-memory',
  },
  openGraph: {
    title: 'Long-horizon agents need memory for trajectories',
    description: 'The case for durable, inspectable memory as the substrate for long-running AI agent work.',
    url: 'https://memexai.space/blog/long-horizon-agents-need-memory',
  },
};

const sources = [
  ['Claude Managed Agents memory', 'https://claude.com/blog/claude-managed-agents-memory'],
  ['Anthropic long-running agent harnesses', 'https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents'],
  ['Claude context engineering cookbook', 'https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools'],
  ['LongMemEval', 'https://arxiv.org/abs/2410.10813'],
  ['MemGPT', 'https://arxiv.org/abs/2310.08560'],
];

export default function LongHorizonAgentsMemoryPage() {
  return (
    <main className="site-shell">
      <article>
        <section className="page-hero">
          <div className="section">
            <div className="eyebrow">
              <GitBranch size={15} aria-hidden />
              Agent memory
            </div>
            <h1>Long-horizon agents need memory for trajectories, not just facts.</h1>
            <p className="section-lede">
              A long-horizon agent is not a single prompt with more tokens. It is a trajectory: observations, decisions,
              failed attempts, corrections, partial progress, project rules, and the next useful action. Memory is the
              substrate that lets the trajectory survive.
            </p>
          </div>
        </section>

        <section className="section article-layout">
          <div className="article-body">
            <p>
              The most useful agent memory is not just a pile of things a user once said. For long-running work, memory
              is how an agent preserves its operating state. It lets the next session know what was already tried, what
              changed, what should not be repeated, which constraints matter, and which source of truth should govern
              the next step.
            </p>

            <p>
              Anthropic&apos;s Managed Agents memory launch is a strong signal here. Their agent memory is file backed,
              scoped, exportable, API-manageable, and audit logged. That matters because agents already know how to use
              files during serious work. A memory layer that behaves like a filesystem gives the model a familiar
              control surface instead of forcing everything through opaque retrieval.
            </p>

            <h2>The bottleneck is trajectory continuity</h2>
            <p>
              Long-running agents fail when every session begins cold. Anthropic&apos;s long-running agent harness work
              is explicit about this pattern: agents get better when they can read recent work, progress files, feature
              lists, and verification state before choosing the next task. The important part is not the exact file
              format. The important part is that the environment gives the agent durable, inspectable state.
            </p>

            <p>
              This is why bigger context windows are an incomplete answer. Context is a finite resource. Even with long
              context, you still need to decide what is worth carrying forward, what can be re-fetched, what should be
              summarized, what should be revised, and what must remain auditable. Memory is the persistent layer where
              those decisions become part of the system.
            </p>

            <div className="article-callout">
              <FileClock size={22} aria-hidden />
              <p>
                A long-horizon agent should remember project state, user preferences, failed paths, durable decisions,
                tool rules, and verification evidence. Those are different memory types with different governance
                needs.
              </p>
            </div>

            <h2>Memory is not one feature</h2>
            <p>
              Research benchmarks are getting more precise. LongMemEval evaluates information extraction,
              multi-session reasoning, temporal reasoning, knowledge updates, and abstention. That taxonomy is a useful
              corrective to vague memory claims. A production memory layer should help with recall, but it should also
              help the agent know when a memory is outdated, when two facts conflict, and when it should avoid answering
              from stale state.
            </p>

            <p>
              MemGPT made the operating-system analogy early: models need memory tiers because the context window is
              limited. The next wave is more operational. A team should be able to open the memory, see what changed,
              understand why an agent behaved differently, and correct the record without rebuilding the whole agent
              stack.
            </p>

            <h2>The product question</h2>
            <p>
              Once memory changes behavior, it becomes product data. If the agent remembers that a user dislikes a
              recommendation style, has an active project constraint, or should follow a workspace policy, that memory
              now shapes the experience. Product teams need the same affordances they expect from other product data:
              visibility, correction, access control, revision history, and deletion paths.
            </p>

            <p>
              MemexAI&apos;s bet is deliberately narrow: keep durable memory in scoped files backed by Postgres. Give
              agents tools to search and update those files. Give humans an admin surface, revisions, and access logs.
              Keep raw transcripts elsewhere. Store the working set that should survive.
            </p>

            <h2>A practical memory stack for long horizons</h2>
            <div className="numbered-grid">
              <div>
                <span>01</span>
                <h3>User memory</h3>
                <p>Preferences, constraints, stable facts, decisions, corrections, and current goals.</p>
              </div>
              <div>
                <span>02</span>
                <h3>Shared guidance</h3>
                <p>Tool instructions, product policies, workspace norms, and behavioral rules.</p>
              </div>
              <div>
                <span>03</span>
                <h3>Progress state</h3>
                <p>Completed steps, open questions, next actions, failure notes, and test evidence.</p>
              </div>
              <div>
                <span>04</span>
                <h3>Audit trail</h3>
                <p>Who wrote a memory, which tool call changed it, and which later reads influenced behavior.</p>
              </div>
            </div>

            <p>
              The long-horizon agent story is not that memory magically makes agents autonomous. It is more grounded:
              memory makes the work continuous enough to debug. The next session starts from a maintained record, not a
              blank prompt.
            </p>

            <div className="hero-actions">
              <Link className="site-button site-button-primary" href="/docs/concepts/shared-memory">
                Read the shared memory guide
                <ArrowRight size={17} aria-hidden />
              </Link>
              <Link className="site-button site-button-secondary" href="/compare">
                Compare memory approaches
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
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="source-panel">
              <Search size={21} aria-hidden />
              <h2>MemexAI angle</h2>
              <p>
                Scoped memory files, shared read-only guidance, revisions, and access logs make long-horizon behavior
                inspectable instead of hidden in prompts or embeddings.
              </p>
            </div>
          </aside>
        </section>
      </article>
    </main>
  );
}
