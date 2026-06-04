import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, CalendarClock, CheckCircle2, FlaskConical, Map, MessageCircle } from 'lucide-react';
import { getFounderCallUrl, slackUrl } from '@/lib/links';
import { RoadmapInterestCard, type RoadmapInterestFeature } from './roadmap-interest-card';

export const metadata: Metadata = {
  title: 'Roadmap',
  description:
    'MemexAI roadmap for persistent user memory: audit snapshots, time travel, memory health, ownership, and production memory workflows.',
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
    id: 'files-time-travel',
    title: 'Files time travel',
    stage: 'Next',
    text: 'Add an As of timestamp view to the Files tab using existing revision history, so operators can browse historical memory and diff it against current files without new database schema.',
  },
  {
    id: 'memory-context-snapshots',
    title: 'Memory context snapshots',
    stage: 'Next',
    text: 'Record per-request memory exposure for prompt builds, recall tools, smart reads, memorize internals, and dream runs so teams can see which memory actually influenced an agent or model call.',
  },
  {
    id: 'memory-health-signals',
    title: 'Memory health signals',
    stage: 'Next',
    text: 'Surface review-worthy memory such as files never used in 30 days, written by one-off agents, missing owners, frequently injected but never updated, or possibly contradicted by newer memory.',
  },
  {
    id: 'ownership-ttl-controls',
    title: 'Ownership and TTL controls',
    stage: 'Next',
    text: 'Give memory files owners, review status, and expiry windows so stale or ownerless memory becomes a visible governance workflow instead of silent drift.',
  },
  {
    id: 'pii-hooks',
    title: 'PII hooks',
    stage: 'Next',
    text: 'Redact, block, or review sensitive memory before writes land in service mode or direct Postgres mode.',
  },
  {
    id: 'team-memory-proposals',
    title: 'Team memory proposals',
    stage: 'Next',
    text: 'Let agents propose updates to shared memory while admins review, accept, reject, or auto-approve contributions.',
  },
  {
    id: 'post-write-hooks',
    title: 'Post-write hooks',
    stage: 'Next',
    text: 'Trigger webhooks after memory changes so Slack, n8n, Zapier, app events, and audit stores can stay in sync.',
  },
];

const exploringFeatures: RoadmapInterestFeature[] = [
  {
    id: 'sidecar-memory-writes',
    title: 'Sidecar memory writes',
    stage: 'Exploring',
    text: 'Pass a raw_data argument to memory_write so bulk transcripts, documents, or structured payloads can be written directly to Postgres without routing the full payload through the model context window.',
  },
  {
    id: 'dreaming-budgets',
    title: 'Per-user dreaming budgets',
    stage: 'Exploring',
    text: 'Track daily background consolidation spend per user and skip dream cycles once the configured budget is exhausted.',
  },
  {
    id: 'dreaming-exclusions',
    title: 'Per-file dreaming exclusions',
    stage: 'Exploring',
    text: 'Let operators mark sensitive or hand-curated memory files as excluded from background dreaming without relying only on global path rules.',
  },
  {
    id: 'named-mounts',
    title: 'Named mounts — team, org, workspace scopes',
    stage: 'Exploring',
    text: 'Register additional memory scopes at init time. A team agent writes to team/itinerary.md and user/prefs.md simultaneously — both isolated, both in the same call. No migration needed.',
  },
  {
    id: 'vector-search',
    title: 'Hybrid search with reciprocal rank fusion',
    stage: 'Exploring',
    text: 'Run BM25 and vector search in parallel, then combine results with Reciprocal Rank Fusion. Queries like "user prefers greenery" find memories written as "loves parks and open space" — no keyword overlap needed. BM25 results are preserved, not replaced. The embedding function is injected at init so there is no hard dependency on any provider. Falls back to BM25-only if no embed function is configured.',
  },
  {
    id: 'reranking-improvements',
    title: 'Confidence and provenance on memories',
    stage: 'Exploring',
    text: 'Attach a confidence score (0–1) and source type (explicit, inferred, consolidated) to each memory file. Explicitly stated facts outrank agent-inferred ones. The dream consolidation job propagates confidence through merges and can downgrade contradicted memories rather than deleting them. Ranking in search and smart_read multiplies by confidence — stale or uncertain memories fade, high-signal ones stay front-of-mind.',
  },
  {
    id: 'source-scoped-memory',
    title: 'Source-scoped memory',
    stage: 'Exploring',
    text: 'Track where facts came from and organize durable memory by app events, documents, projects, and conversations.',
  },
  {
    id: 'link-aware-memory',
    title: 'Bidirectional memory links',
    stage: 'Exploring',
    text: 'Index memory links as a precomputed backlink graph. memory_smart_read today only follows links forward — with reverse traversal, seeding on a hub file also surfaces the most recent notes that reference it (visit logs, chat summaries, corrections). Files with many inbound references rank higher in search. Hub files become self-enriching context anchors instead of static snapshots.',
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
    title: 'Automatic-only memory health',
    text: 'De-prioritized as a standalone cleanup-only feature because dreaming covers part of the background maintenance loop. Diagnostics, audit snapshots, health signals, and operator review are now reprioritized as production trust features.',
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
