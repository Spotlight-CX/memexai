import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'Terms for using the MemexAI website and open-source project resources.',
  alternates: {
    canonical: '/legal/terms',
  },
};

export default function TermsPage() {
  return (
    <main className="site-shell">
      <section className="page-hero legal-hero">
        <div className="section">
          <div className="section-kicker">Legal</div>
          <h1>Terms</h1>
          <p className="section-lede">
            MemexAI is open-source software. These terms cover use of the public website, documentation, and community
            resources. Software use is governed by the license included with the project.
          </p>
        </div>
      </section>
      <section className="section legal-copy">
        <h2>Use of the Website</h2>
        <p>
          Use the website and documentation responsibly. Do not attempt to disrupt, scrape abusively, or misuse public
          project resources.
        </p>
        <h2>Open-Source Software</h2>
        <p>
          MemexAI code is distributed under the license in the repository. Review that license before using, modifying,
          or redistributing the software.
        </p>
        <h2>No Warranty</h2>
        <p>
          The website, docs, examples, and open-source software are provided as-is, without guarantees of availability,
          correctness, or fitness for a particular purpose.
        </p>
      </section>
    </main>
  );
}
