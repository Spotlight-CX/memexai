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
          The public website uses PostHog product analytics for page requests, browser type, referral source,
          approximate location, and CTA interactions. Roadmap interest analytics do not include your note or email.
          Community links may take you to third-party services with their own policies.
        </p>
        <h2>Self-Hosted Memory Data</h2>
        <p>
          MemexAI service telemetry is enabled by default for OSS service deployments. It sends anonymous product usage
          events such as service startup, tool names, MCP usage, dreaming status, route groups, success/failure, and
          duration buckets. It does not send memory content, prompts, file paths, tool arguments, user IDs, API keys,
          admin secrets, or database URLs. Disable it with `MEMEX_TELEMETRY_DISABLED=true`.
        </p>
        <h2>Contact</h2>
        <p>For privacy questions, use the GitHub repository or community support link in the footer.</p>
      </section>
    </main>
  );
}
