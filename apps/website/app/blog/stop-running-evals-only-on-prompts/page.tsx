import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BookOpen, ClipboardCheck, FileSearch, ListChecks } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Stop running evals only on prompts',
  description:
    'Why AI teams should evaluate memory state, shared behavioral guidance, and retrieval traces instead of treating prompts as the whole behavior surface.',
  alternates: {
    canonical: '/blog/stop-running-evals-only-on-prompts',
  },
  openGraph: {
    title: 'Stop running evals only on prompts',
    description: 'Your memory layer changes agent behavior. Evaluate it as part of the system.',
    url: 'https://memexai.space/blog/stop-running-evals-only-on-prompts',
  },
};

const sources = [
  ['LongMemEval', 'https://arxiv.org/abs/2410.10813'],
  ['Claude context engineering cookbook', 'https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools'],
  ['The Living Wiki', 'https://openreview.net/attachment?id=e64EcfHp8L&name=pdf'],
  ['Mem0 paper', 'https://arxiv.org/abs/2504.19413'],
];

export default function PromptMemoryEvalsPage() {
  return (
    <main className="site-shell">
      <article>
        <section className="page-hero">
          <div className="section">
            <div className="eyebrow">
              <ClipboardCheck size={15} aria-hidden />
              Memory evals
            </div>
            <h1>Stop running evals only on prompts. Your memory changes behavior too.</h1>
            <p className="section-lede">
              Prompt evals are necessary, but they are no longer sufficient. If your agent reads user memory, shared
              policy files, tool guides, project notes, or retrieved history before acting, then memory is part of the
              behavior surface.
            </p>
          </div>
        </section>

        <section className="section article-layout">
          <div className="article-body">
            <p>
              A prompt-only eval assumes the prompt is the main thing shaping behavior. That was closer to true when
              assistants were stateless. It is less true for agents. Modern agents read context, call tools, summarize
              progress, retrieve history, and write memory that affects later sessions.
            </p>

            <p>
              The failure mode is subtle: the prompt passes, but the product still behaves differently in production
              because the memory state is different. A stale preference, a missing policy, an outdated tool instruction,
              or an over-broad retrieved note can change the answer more than a prompt wording tweak.
            </p>

            <h2>Memory is behavioral context</h2>
            <p>
              Shared memory can act like a durable tool guide. A file such as <code>shared/AGENTS.md</code> can tell an
              agent how to use tools, what not to do, which policies are read-only, and how to resolve conflicts. A user
              file such as <code>user/preferences.md</code> can steer tone, recommendations, ranking, and default
              assumptions.
            </p>

            <p>
              The Living Wiki paper gives a useful research frame: a maintained knowledge base can include both content
              and a separate governing protocol. In product terms, that means the memory layer is not only a database of
              facts. It can also contain behavioral instructions that persist across sessions.
            </p>

            <div className="article-callout">
              <FileSearch size={22} aria-hidden />
              <p>
                If an agent reads a memory before answering, include that memory in the eval fixture. Otherwise you are
                testing a cleaner system than the one users actually experience.
              </p>
            </div>

            <h2>What to evaluate instead</h2>
            <p>
              LongMemEval is useful because it breaks memory into concrete capabilities: extraction, multi-session
              reasoning, temporal reasoning, knowledge updates, and abstention. Product teams can adapt the same spirit
              without copying the benchmark. The question is not &quot;did the prompt answer correctly?&quot; It is
              &quot;did the agent use the right memory, update it correctly, and avoid stale or unsupported
              memory?&quot;
            </p>

            <div className="numbered-grid">
              <div>
                <span>01</span>
                <h3>Memory read set</h3>
                <p>Which files or retrieved records were injected before the answer?</p>
              </div>
              <div>
                <span>02</span>
                <h3>Memory write diff</h3>
                <p>What changed after the interaction, and was the change justified?</p>
              </div>
              <div>
                <span>03</span>
                <h3>Conflict handling</h3>
                <p>Did the agent notice newer facts, corrections, policy priority, and uncertainty?</p>
              </div>
              <div>
                <span>04</span>
                <h3>Abstention</h3>
                <p>Did the agent avoid using memory when the record was missing, stale, or ambiguous?</p>
              </div>
            </div>

            <h2>A memory-aware eval loop</h2>
            <p>
              Start every eval case with an explicit memory fixture. Run the agent. Capture the answer, tool calls,
              memory reads, and memory writes. Then score both behavior and state transition. A correct answer with a
              bad memory write is not a pass; it is a future regression waiting to happen.
            </p>

            <pre className="article-code">{`case: "Returning user asks for recommendations"
initial_memory:
  user/profile.md: "Prefers quiet neighborhoods. Budget is strict."
  shared/AGENTS.md: "Never infer budget changes without user confirmation."
expected:
  reads: ["user/profile.md", "shared/AGENTS.md"]
  answer: "respects quiet + budget constraints"
  writes: "no budget mutation unless user explicitly changes it"`}</pre>

            <p>
              This is where inspectable memory matters. If your memory is only an embedding or an opaque extraction
              pipeline, eval failures are harder to diagnose. If memory is a scoped file with revisions and access logs,
              the eval can point to the exact state that caused the behavior.
            </p>

            <h2>The practical claim</h2>
            <p>
              Prompt quality still matters. But once your agent has memory, behavior is a function of prompt, tools,
              memory state, retrieval, and write policy. Teams that only eval prompts are optimizing one part of a
              larger system.
            </p>

            <div className="hero-actions">
              <Link className="site-button site-button-primary" href="/docs/concepts/shared-memory">
                See the docs pattern
                <ArrowRight size={17} aria-hidden />
              </Link>
              <Link className="site-button site-button-secondary" href="/docs/concepts/revisions">
                Review revisions
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
              <ListChecks size={21} aria-hidden />
              <h2>Eval target</h2>
              <p>
                Score the answer and the memory transition: what was read, what changed, and whether the new state will
                make the next session better.
              </p>
            </div>
          </aside>
        </section>
      </article>
    </main>
  );
}
