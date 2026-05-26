import { Inter } from 'next/font/google';
import { Provider } from '@/components/provider';
import { SiteFooter } from '@/components/site-footer';
import './global.css';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://memexai.space'),
  title: {
    default: 'MemexAI - Persistent user memory for AI products',
    template: '%s | MemexAI',
  },
  description:
    'Persistent user memory for AI products: inspectable memory files, revisions, access logs, and Postgres-native storage.',
  keywords: [
    'AI memory',
    'agent memory',
    'user memory',
    'AI personalization',
    'Postgres memory',
    'Mem0 alternative',
    'Zep alternative',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'MemexAI - Persistent user memory for AI products',
    description:
      'Inspectable memory files for AI products. No vector database required. Backed by Postgres.',
    type: 'website',
    url: 'https://memexai.space',
    siteName: 'MemexAI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MemexAI - Persistent user memory for AI products',
    description:
      'Inspectable memory files for AI products. No vector database required. Backed by Postgres.',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>
          {children}
          <SiteFooter />
        </Provider>
      </body>
    </html>
  );
}
