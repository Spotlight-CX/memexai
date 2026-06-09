import { Inter, Instrument_Serif } from 'next/font/google';
import { Provider } from '@/components/provider';
import { SiteFooter } from '@/components/site-footer';
import { Analytics } from '@/components/analytics';
import './global.css';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://memexai.space'),
  title: {
    default: 'MemexAI - Inspectable memory infrastructure for AI agents',
    template: '%s | MemexAI',
  },
  icons: {
    icon: '/logo.svg',
  },
  description:
    'Inspectable memory infrastructure for multi-tenant AI agents: scoped Postgres files, revisions, access logs, admin operations, and background dreaming.',
  keywords: [
    'AI memory',
    'agent memory',
    'user memory',
    'AI personalization',
    'Mem0 alternative',
    'Zep alternative',
    'Maximem alternative',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'MemexAI - Inspectable memory infrastructure for AI agents',
    description:
      'Scoped Postgres memory files for AI agents, with revisions, access logs, admin operations, and background dreaming.',
    type: 'website',
    url: 'https://memexai.space',
    siteName: 'MemexAI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MemexAI - Inspectable memory infrastructure for AI agents',
    description:
      'Scoped Postgres memory files for AI agents, with revisions, access logs, admin operations, and background dreaming.',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} ${inter.className}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>
          <Analytics />
          {children}
          <SiteFooter />
        </Provider>
      </body>
    </html>
  );
}
