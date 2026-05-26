import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for the MemexAI website and public project resources.',
  alternates: {
    canonical: '/legal/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <main className="site-shell">
      <section className="page-hero legal-hero">
        <div className="section">
          <div className="section-kicker">Legal</div>
          <h1>Privacy Policy</h1>
          <p className="section-lede">
            This policy covers the public MemexAI website. Self-hosted MemexAI deployments run in your infrastructure,
            and their data handling is controlled by your own application and deployment choices.
          </p>
        </div>
      </section>
      <section className="section legal-copy">
        <h2>Information We Receive</h2>
        <p>
          The public website may receive standard server and analytics information such as page requests, browser type,
          referral source, and approximate location. Community links may take you to third-party services with their own
          policies.
        </p>
        <h2>Self-Hosted Memory Data</h2>
        <p>
          MemexAI does not receive memory files from your self-hosted deployment unless you choose to send data to a
          third-party service or share it with the project maintainers.
        </p>
        <h2>Contact</h2>
        <p>For privacy questions, use the GitHub repository or community support link in the footer.</p>
      </section>
    </main>
  );
}
