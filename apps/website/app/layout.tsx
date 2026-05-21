import { Inter } from 'next/font/google';
import { Provider } from '@/components/provider';
import './global.css';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://memexai.dev'),
  title: {
    default: 'MemexAI',
    template: '%s | MemexAI',
  },
  description: 'Persistent memory for AI agents, backed by Postgres.',
  openGraph: {
    title: 'MemexAI',
    description: 'Persistent memory for AI agents, backed by Postgres.',
    type: 'website',
    url: 'https://memexai.dev',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
