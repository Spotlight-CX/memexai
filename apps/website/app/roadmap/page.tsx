import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CalendarClock, CheckCircle2, FlaskConical, Map, MessageCircle } from 'lucide-react';
import { getFounderCallUrl, slackUrl } from '@/lib/links';
import { RoadmapInterestCard, type RoadmapInterestFeature } from './roadmap-interest-card';

export const metadata: Metadata = {
  title: 'Roadmap',
  description:
    'MemexAI roadmap for persistent user memory: dreaming, PII hooks, source scopes, vector search, reranking, and production memory workflows.',
  alternates: {
    canonical: '/roadmap',
  },
  openGraph: {
    title: 'MemexAI Roadmap',
    description:
      'Register interest in upcoming MemexAI features and tell us which memory workflows matter for your AI product.',
    url: 'https://memexai.space/roadmap',
  },
};

const shipped = [
  'Postgres-backed memory files',
  'Revision history and access logs',
  'Admin UI and Playground',
  'TypeScript and Python SDKs',
  'MCP over SSE and stdio',
  'Scoped user/ and shared/ memory',
];

const nextFeatures: RoadmapInterestFeature[] = [
  {
    id: 'pii-hooks',
    title: 'PII hooks',
    stage: 'Next',
    text: 'Redact, block, or review sensitive memory before writes land in service mode or direct Postgres mode.',
  },
  {
    id: 'post-write-hooks',
    title: 'Post-write hooks',
    stage: 'Next',
    text: 'Trigger webhooks after memory changes so Slack, n8n, Zapier, app events, and audit stores can stay in sync.',
  },
  {
    id: 'team-memory-proposals',
    title: 'Team memory proposals',
    stage: 'Next',
    text: 'Let agents propose updates to shared memory while admins review, accept, reject, or auto-approve contributions.',
  },
];

const exploringFeatures: RoadmapInterestFeature[] = [
  {
    id: 'source-scoped-isolation',
    title: 'Isolation beyond user scope',
    stage: 'Exploring',
    text: 'Add source, workspace, customer, project, or team scopes while preserving the simple virtual path model.',
  },
  {
    id: 'vector-search',
    title: 'Optional vector search',
    stage: 'Exploring',
    text: 'Keep Postgres full-text as the default while supporting opt-in semantic retrieval for larger memory sets.',
  },
  {
    id: 'reranking-improvements',
    title: 'Reranking improvements',
    stage: 'Exploring',
    text: 'Improve memory_search with stronger candidate selection, model-backed reranking, and grounded summaries.',
  },
  {
    id: 'source-scoped-memory',
    title: 'Source-scoped memory',
    stage: 'Exploring',
    text: 'Track where facts came from and organize durable memory by app events, documents, projects, and conversations.',
  },
  {
    id: 'link-aware-memory',
    title: 'Link-aware memory',
    stage: 'Exploring',
    text: 'Treat explicit links between memory files as useful navigation signals for humans and agents.',
  },
];

const doneFeatures = [
  {
    title: 'Dreaming and background synthesis',
    text: 'Shipped as opt-in service-mode consolidation. Dreaming waits for quiet memory, merges duplicates, clarifies fragmented notes, resolves direct contradictions, and writes normal revisions as dream-agent.',
  },
  {
    title: 'Admin Dreams panel',
    text: 'Operators can read dream config, update cadence and write budgets, inspect per-user dream status, and pause or resume dreaming for specific users.',
  },
  {
    title: 'Dream-safe audit trail',
    text: 'Dream runs skip log files, avoid no-op dream-log entries, record files_touched, and preserve the same revision/access-log trail as normal memory writes.',
  },
];

const deprioritizedFeatures = [
  {
    title: 'Memory health',
    text: 'De-prioritized as a standalone roadmap item because dreaming now covers the highest-value health work: duplicates, stale contradictions, fragmented notes, and low-signal cleanup between sessions.',
  },
  {
    title: 'Memory compaction',
    text: 'De-prioritized as a separate feature because dreaming already summarizes, deduplicates, and keeps long-running memory files readable while preserving revisions as the original trail.',
  },
];

export default function RoadmapPage() {
  const founderCallUrl = getFounderCallUrl();

  return (
    <main className="site-shell">
      <section className="page-hero roadmap-hero">
        <div className="section">
          <div className="eyebrow">
            <Map size={15} aria-hidden />
            Public roadmap
          </div>
          <h1>Tell us what memory workflows matter for your AI product.</h1>
          <p className="section-lede">
            This roadmap is directional, not a promise board. Register interest, leave a note about your use case, or
            schedule time with the founder if your product has a real memory problem today.
          </p>
          <div className="hero-actions">
            <a className="site-button site-button-primary" href={founderCallUrl} target="_blank" rel="noopener noreferrer">
              <CalendarClock size={17} aria-hidden />
              Schedule a founder call
              <ArrowRight size={17} aria-hidden />
            </a>
            <a className="site-button site-button-secondary" href={slackUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={17} aria-hidden />
              Share notes in Slack
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Now / shipped</div>
        <h2>The foundation is already live.</h2>
        <div className="roadmap-shipped-grid">
          {shipped.map((item) => (
            <div className="roadmap-shipped" key={item}>
              <CheckCircle2 size={19} aria-hidden />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Next</div>
        <h2>Near-term work that makes memory more trustworthy in production.</h2>
        <p className="section-lede">
          These are the features most closely tied to operating durable user memory once real usage starts accumulating.
        </p>
        <div className="roadmap-grid">
          {nextFeatures.map((feature) => (
            <RoadmapInterestCard feature={feature} key={feature.id} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Exploring</div>
        <h2>Bigger bets we will only build if the pull is real.</h2>
        <p className="section-lede">
          Some teams need richer retrieval, broader isolation boundaries, or background synthesis. Tell us which of
          these would change your roadmap.
        </p>
        <div className="roadmap-grid">
          {exploringFeatures.map((feature) => (
            <RoadmapInterestCard feature={feature} key={feature.id} />
          ))}
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Done / absorbed</div>
        <h2>Dreaming moved from roadmap bet to shipped memory infrastructure.</h2>
        <p className="section-lede">
          Background dreaming now handles the cleanup work that used to sit behind separate memory health and compaction
          roadmap items. We may still add sharper diagnostics later, but the default product direction is to solve these
          through automatic consolidation.
        </p>
        <div className="roadmap-done-grid">
          {doneFeatures.map((feature) => (
            <div className="roadmap-done" key={feature.title}>
              <CheckCircle2 size={20} aria-hidden />
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="roadmap-grid roadmap-deprioritized-grid">
          {deprioritizedFeatures.map((feature) => (
            <div className="roadmap-card roadmap-deprioritized" key={feature.title}>
              <div>
                <span className="roadmap-pill">De-prioritized</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
              <Link className="site-button site-button-secondary" href="/dreaming">
                See how dreaming covers this
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div className="section">
          <div className="section-kicker">Founder call</div>
          <h2>Building an AI product where users feel forgotten?</h2>
          <p className="section-lede">
            A short founder call is the fastest way to map your current memory approach, the retention pain, and whether
            MemexAI should fit now or later.
          </p>
          <div className="hero-actions">
            <a className="site-button site-button-primary" href={founderCallUrl} target="_blank" rel="noopener noreferrer">
              <CalendarClock size={17} aria-hidden />
              Schedule a founder call
            </a>
            <Link className="site-button site-button-secondary" href="/docs/quickstart/docker-service">
              Docker quickstart
            </Link>
            <a className="site-button site-button-secondary" href={slackUrl} target="_blank" rel="noopener noreferrer">
              Personal notes? Use Slack
            </a>
          </div>
        </div>
      </section>

      <section className="section roadmap-note">
        <FlaskConical size={20} aria-hidden />
        <p>
          Roadmap votes are product signal, not commitments. We use them to prioritize conversations and choose what to
          make legible, durable, and self-hostable next.
        </p>
      </section>
    </main>
  );
}
