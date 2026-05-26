import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, MonitorPlay, PlayCircle, Terminal } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI Video Walkthroughs',
  description:
    'Guided MemexAI walkthroughs for Docker setup, the admin playground, SDK integration, and debugging user memory.',
  alternates: {
    canonical: '/walkthroughs',
  },
  openGraph: {
    title: 'MemexAI Video Walkthroughs',
    description:
      'Guided MemexAI walkthroughs for Docker setup, the admin playground, SDK integration, and debugging user memory.',
    url: 'https://memexai.space/walkthroughs',
  },
};

const walkthroughs = [
  {
    title: 'Docker to first memory',
    duration: '4 min',
    text: 'Run the service, open the admin UI, memorize a durable user preference, and search it in the next session.',
  },
  {
    title: 'Admin Playground tour',
    duration: '5 min',
    text: 'Use Memorize, Search, dry runs, user scope switching, revisions, and raw tools without writing SQL.',
  },
  {
    title: 'Vercel AI SDK integration',
    duration: '6 min',
    text: 'Wire `memory_memorize` and `memory_search` into a real assistant with the TypeScript SDK.',
  },
  {
    title: 'Debugging bad memory',
    duration: '5 min',
    text: 'Find the file, inspect the revision trail, correct the record, and verify the next recall.',
  },
];

export default function WalkthroughsPage() {
  return (
    <main className="site-shell">
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <MonitorPlay size={15} aria-hidden />
            Product walkthroughs
          </div>
          <h1>See persistent memory working end to end.</h1>
          <p className="section-lede">
            These walkthrough slots map to the core adoption path: start the service, test memory in the admin
            Playground, wire the SDK into an assistant, then debug what the AI remembered.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/quickstart/docker-service">
              Follow the Docker quickstart
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/compare">
              Compare memory approaches
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Walkthrough queue</div>
        <h2>The first videos should sell the product by showing the workflow.</h2>
        <div className="feature-grid">
          {walkthroughs.map((item) => (
            <div className="feature" key={item.title}>
              <PlayCircle size={24} aria-hidden />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <p className="small-meta">{item.duration}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Recording checklist</div>
        <h2>Make the admin UI the proof, not a narrated slide deck.</h2>
        <div className="split">
          <div className="path-panel">
            <Terminal size={24} aria-hidden />
            <h3>Show real commands</h3>
            <p>Start from `docker compose up`, then use the same API key and admin secret from the quickstart.</p>
          </div>
          <div className="path-panel">
            <MonitorPlay size={24} aria-hidden />
            <h3>Show the memory trail</h3>
            <p>Every video should end by opening the file or revision that proves what the AI remembered.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
