import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Database,
  FileClock,
  GitCompareArrows,
  PauseCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Background Dreaming',
  description:
    'Background memory consolidation for multi-session agents: deduplicate, compact, clarify, and preserve an audit trail between sessions.',
  alternates: {
    canonical: '/dreaming',
  },
  openGraph: {
    title: 'Background Dreaming for AI Memory',
    description:
      'MemexAI dreaming keeps multi-session memory files clean, readable, and auditable between agent sessions.',
    url: 'https://memexai.space/dreaming',
  },
};

const problems = [
  {
    icon: FileClock,
    title: 'Multi-session memory gets messy',
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
  'Duplicate facts across active memory files',
  'Fragmented notes that should become one stable record',
  'Direct contradictions after a user corrects themselves',
  'Low-signal memory that makes future recall noisy',
  'Readable memory files for agents that return days or weeks later',
  'Operator visibility into background consolidation status',
];

const researchSignals = [
  {
    icon: GitCompareArrows,
    title: 'The category is moving toward consolidation',
    text: 'Anthropic Managed Agents Dreams turns memory cleanup into a first-class primitive: read past sessions, curate memory, and produce a cleaner store for future work.',
  },
  {
    icon: Database,
    title: 'MemexAI keeps the source of truth in your stack',
    text: 'Dreaming runs against memory owned by your application, not a hosted agent runtime that owns the memory lifecycle.',
  },
  {
    icon: BookOpen,
    title: 'The product page is the operator surface',
    text: 'The deeper research argument lives in the blog. This page focuses on what teams can enable, inspect, pause, and operate today.',
  },
];

const dreamLoop = [
  'changed memory files',
  'quiet grace period',
  'bounded consolidation',
  'normal memory patch',
  'revision + access log',
  'cleaner next session',
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
          <h1>Dreaming keeps multi-session agent memory clean between sessions.</h1>
          <p className="section-lede">
            Agents accumulate memory while users work. Over longer trajectories, that memory needs a second pass:
            deduplicate repeated facts, resolve corrections, compact sprawling notes, and preserve the trail. MemexAI
            dreaming does that in the background after memory has been quiet.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/operations/dreaming">
              Read the operations guide
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/blog/why-we-shipped-dreaming-for-ai-memory">
              Why we shipped Dreaming
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Why it exists</div>
        <h2>Memory is trajectory infrastructure, not just recall.</h2>
        <p className="section-lede">
          A returning agent does not only need facts. It needs a durable record of what changed, what was corrected,
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
        <div className="section-kicker">Research context</div>
        <h2>Dreaming is product infrastructure, not a naming gimmick.</h2>
        <p className="section-lede">
          Agent memory is moving from simple recall toward maintained state. Anthropic&apos;s Managed Agents Dreams is a
          strong signal for the category. MemexAI applies the same consolidation pressure to app-owned memory: scoped
          files, normal write paths, revisions, access logs, and operator controls.
        </p>
        <div className="feature-grid">
          {researchSignals.map((item) => {
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
        <div className="hero-actions">
          <Link className="site-button site-button-secondary" href="/blog/why-we-shipped-dreaming-for-ai-memory">
            Read the research note
            <ArrowRight size={17} aria-hidden />
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">How it runs</div>
        <h2>A quiet, bounded cleanup loop for durable memory.</h2>
        <p className="section-lede">
          Dreaming does not mine raw transcripts or rewrite memory through a hidden path. It waits for memory to settle,
          skips logs, writes through normal memory tools, and keeps the trail visible.
        </p>
        <div className="loop-diagram product-loop" aria-label="MemexAI Dreaming product flow">
          {dreamLoop.map((step, index) => (
            <div key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
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
          <div className="path-panel">
            <Sparkles size={24} aria-hidden />
            <h3>Keep memory high-signal</h3>
            <p>
              The dream agent can merge duplicates, compact fragmented notes, and resolve direct corrections without
              turning raw session history into permanent user identity.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
