import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CalendarClock, CheckCircle2, FlaskConical, Map, MessageCircle } from 'lucide-react';
import { getFounderCallUrl, slackUrl } from '@/lib/links';
import { RoadmapInterestCard, type RoadmapInterestFeature } from './roadmap-interest-card';

export const metadata: Metadata = {
  title: 'Roadmap',
  description:
    'MemexAI roadmap for persistent user memory: memory health, compaction, PII hooks, source scopes, vector search, reranking, and background synthesis.',
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
    id: 'memory-health',
    title: 'Memory health',
    stage: 'Next',
    text: 'Find stale facts, missing index entries, duplicate notes, orphan files, and low-signal memory before trust decays.',
  },
  {
    id: 'memory-compaction',
    title: 'Memory compaction',
    stage: 'Next',
    text: 'Keep long-running memory files readable by summarizing, deduplicating, and preserving the original trail.',
  },
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
    id: 'dreaming-background-synthesis',
    title: 'Dreaming and background synthesis',
    stage: 'Exploring',
    text: 'Let memory improve between sessions with background reflection, consolidation, and suggested next writes.',
  },
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
