import Link from 'next/link';
import { GitPullRequest, MessageCircle } from 'lucide-react';
import { slackUrl } from '@/lib/links';

const footerGroups = [
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Docker quickstart', href: '/docs/quickstart/docker-service' },
      { label: 'Walkthroughs', href: '/walkthroughs' },
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
      { label: 'Admin UI', href: '/docs/quickstart/direct-postgres' },
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
          <Link href="/" className="footer-logo" aria-label="MemexAI home">
            <span className="footer-logo-mark">mx</span>
            <span>MemexAI</span>
          </Link>
          <p>Persistent user memory for AI products.</p>
          <div className="created-by">
            <span>Created by</span>
            <a href="https://github.com/Spotlight-CX" target="_blank" rel="noopener noreferrer">
              Spotlight CX
            </a>
          </div>
        </div>

        <nav className="site-footer-grid" aria-label="Footer navigation">
          {footerGroups.map((group) => (
            <div className="footer-column" key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href}>{link.label}</Link>
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
            <a href="https://github.com/Spotlight-CX/memexai" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <GitPullRequest size={17} aria-hidden />
            </a>
            <a
              href={slackUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Slack support"
            >
              <MessageCircle size={17} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
