import Link from 'next/link';
import { GitPullRequest, MessageCircle } from 'lucide-react';
import { slackUrl } from '@/lib/links';
import { BrandMark } from '@/components/brand-mark';

const footerGroups = [
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '/blog' },
      { label: 'Dreaming', href: '/dreaming' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Docker quickstart', href: '/docs/quickstart/docker-service' },
    ],
  },
  {
    title: 'Compare',
    links: [
      { label: 'AI memory tools', href: '/compare' },
      { label: 'Mem0 alternative', href: '/compare/mem0' },
      { label: 'Zep alternative', href: '/compare/zep' },
      { label: 'Vector DB alternative', href: '/compare/vector-database' },
    ],
  },
  {
    title: 'Products',
    links: [
      { label: 'TypeScript SDK', href: '/docs/sdks/typescript' },
      { label: 'Python SDK', href: '/docs/sdks/python' },
      { label: 'MCP server', href: '/docs/mcp' },
      { label: 'Shared memory', href: '/docs/concepts/shared-memory' },
      { label: 'Dreaming ops', href: '/docs/operations/dreaming' },
    ],
  },
  {
    title: 'Legals',
    links: [
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Cookie Policy', href: '/legal/cookies' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'GitHub', href: 'https://github.com/Spotlight-CX/memexai', external: true },
      {
        label: 'Slack support',
        href: slackUrl,
        external: true,
      },
      { label: 'LLMs.txt', href: '/llms.txt' },
      { label: 'Full LLM docs', href: '/llms-full.txt' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <BrandMark size="footer" />
          <p>Persistent user memory for AI products.</p>
        </div>

        <nav className="site-footer-grid" aria-label="Footer navigation">
          {footerGroups.map((group) => (
            <div className="footer-column" key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" data-analytics-event="footer_link_clicked" data-analytics-label={link.label}>
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} data-analytics-event="footer_link_clicked" data-analytics-label={link.label}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="site-footer-bottom">
          <span>© 2026 MemexAI. Open-source memory infrastructure.</span>
          <div>
            <a href="https://github.com/Spotlight-CX/memexai" target="_blank" rel="noopener noreferrer" aria-label="GitHub" data-analytics-event="footer_link_clicked" data-analytics-label="GitHub icon">
              <GitPullRequest size={17} aria-hidden />
            </a>
            <a
              href={slackUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Slack support"
              data-analytics-event="footer_link_clicked"
              data-analytics-label="Slack icon"
            >
              <MessageCircle size={17} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
