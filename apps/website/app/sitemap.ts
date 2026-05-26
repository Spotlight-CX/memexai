import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const baseUrl = 'https://memexai.space';

const routes = [
  '/',
  '/docs',
  '/docs/quickstart/docker-service',
  '/docs/quickstart/direct-postgres',
  '/docs/sdks/typescript',
  '/docs/sdks/python',
  '/docs/mcp',
  '/docs/architecture',
  '/roadmap',
  '/compare',
  '/compare/mem0',
  '/compare/zep',
  '/compare/vector-database',
  '/walkthroughs',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date('2026-05-26'),
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route.startsWith('/docs') ? 0.8 : 0.7,
  }));
}
