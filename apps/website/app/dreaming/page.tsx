import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Brain, CheckCircle2, FileClock, PauseCircle, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Background Dreaming',
  description:
    'Background memory consolidation for long-horizon agents: deduplicate, compact, clarify, and preserve an audit trail between sessions.',
  alternates: {
    canonical: '/dreaming',
  },
  openGraph: {
    title: 'Background Dreaming for AI Memory',
    description:
      'MemexAI dreaming keeps long-running memory files clean, readable, and auditable between agent sessions.',
    url: 'https://memexai.space/dreaming',
  },
};

const problems = [
  {
    icon: FileClock,
    title: 'Long-horizon memory gets messy',
    text: 'Agent trajectories produce partial decisions, repeated facts, contradictions, and notes that made sense in the moment but need consolidation later.',
  },
  {
    icon: Brain,
    title: 'Context windows are not continuity',
    text: 'A larger prompt can carry more text, but it cannot decide what should survive. Dreaming turns accumulated memory into cleaner state for the next session.',
  },
  {
    icon: ShieldCheck,
    title: 'Cleanup still needs an audit trail',
    text: 'Dream writes use normal memory_write and memory_patch paths, so revisions and access logs stay intact instead of hiding consolidation in a black box.',
  },
];

const solved = [
  'Duplicate facts across long-running files',
  'Fragmented notes that should become one stable record',
  'Direct contradictions after a user corrects themselves',
  'Low-signal memory that makes future recall noisy',
  'Readable user files for agents that return days or weeks later',
  'Operator visibility into background consolidation status',
];

export default function DreamingPage() {
  return (
    <main className="site-shell">
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <Brain size={15} aria-hidden />
            Background memory consolidation
          </div>
          <h1>Dreaming keeps long-horizon agent memory clean between sessions.</h1>
          <p className="section-lede">
            Agents accumulate memory while users work. Over longer trajectories, that memory needs a second pass:
            deduplicate repeated facts, resolve corrections, compact sprawling notes, and preserve the trail. MemexAI
            dreaming does that in the background after user memory has been quiet.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/operations/dreaming">
              Read the operations guide
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/blog/long-horizon-agents-need-memory">
              Long-horizon memory essay
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Why it exists</div>
        <h2>Memory is trajectory infrastructure, not just recall.</h2>
        <p className="section-lede">
          A long-running agent does not only need facts. It needs a durable record of what changed, what was corrected,
          what should be carried forward, and what can be safely ignored next time.
        </p>
        <div className="feature-grid">
          {problems.map((item) => {
            const Icon = item.icon;
            return (
              <div className="feature" key={item.title}>
                <Icon size={24} aria-hidden />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">What dreaming solves</div>
        <h2>It absorbs the first wave of memory health and compaction work.</h2>
        <div className="trust-list">
          {solved.map((item) => (
            <div key={item}>
              <CheckCircle2 size={20} aria-hidden />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Operator control</div>
        <h2>Dreaming is automatic, but not uncontrolled.</h2>
        <div className="split">
          <div className="path-panel">
            <PauseCircle size={24} aria-hidden />
            <h3>Pause globally or per user</h3>
            <p>
              Use the global dream config as the master switch, or pause one user from the Dreams panel/API when a
              workspace needs manual review.
            </p>
          </div>
          <div className="path-panel">
            <FileClock size={24} aria-hidden />
            <h3>Inspect every effect</h3>
            <p>
              Dream writes create revisions with actor dream-agent. If the agent finds nothing useful to update, it
              records zero files touched and avoids adding noise to dream-log.md.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
