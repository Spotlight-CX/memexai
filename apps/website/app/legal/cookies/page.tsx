import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Cookie policy for the MemexAI website.',
  alternates: {
    canonical: '/legal/cookies',
  },
};

export default function CookiesPage() {
  return (
    <main className="site-shell">
      <section className="page-hero legal-hero">
        <div className="section">
          <div className="section-kicker">Legal</div>
          <h1>Cookie Policy</h1>
          <p className="section-lede">
            The MemexAI website is designed to keep tracking minimal. Any cookies used by the site should support basic
            functionality, documentation behavior, or aggregate product analytics.
          </p>
        </div>
      </section>
      <section className="section legal-copy">
        <h2>Cookie Use</h2>
        <p>
          The site may use essential cookies or local storage for documentation preferences and browser behavior.
          Third-party services linked from the site may set their own cookies.
        </p>
        <h2>Control</h2>
        <p>You can block or delete cookies in your browser settings. Some documentation preferences may reset.</p>
        <h2>Updates</h2>
        <p>This policy may change as the website adds analytics, docs features, or community integrations.</p>
      </section>
    </main>
  );
}
