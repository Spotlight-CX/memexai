import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BookOpen, FileClock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MemexAI Blog',
  description: 'Deep technical writing on agent memory, long-horizon agents, evals, and inspectable AI product state.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'MemexAI Blog',
    description: 'Technical essays on durable memory for AI agents and products.',
    url: 'https://memexai.space/blog',
  },
};

const posts = [
  {
    href: '/blog/long-horizon-agents-need-memory',
    title: 'Long-horizon agents need memory for trajectories, not just facts',
    description:
      'Why durable memory matters when agents work across sessions, context windows, tools, corrections, and project-specific state.',
    label: 'Agent architecture',
  },
  {
    href: '/blog/stop-running-evals-only-on-prompts',
    title: 'Stop running evals only on prompts. Your memory changes behavior too',
    description:
      'Prompt evals miss the behavioral surface created by shared memory, tool guides, user records, and cross-session state.',
    label: 'Memory evals',
  },
];

export default function BlogPage() {
  return (
    <main className="site-shell">
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <BookOpen size={15} aria-hidden />
            Deep memory notes
          </div>
          <h1>Research-backed writing on agent memory.</h1>
          <p className="section-lede">
            Practical essays on long-horizon agents, memory evals, shared behavioral guidance, and why inspectable
            memory becomes product infrastructure once it shapes user experience.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="feature-grid two-up-grid">
          {posts.map((post) => (
            <Link className="feature link-card article-card" href={post.href} key={post.href}>
              <FileClock size={24} aria-hidden />
              <span className="small-meta">{post.label}</span>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
              <span className="text-link">
                Read the essay
                <ArrowRight size={16} aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
