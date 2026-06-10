import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'EdTech AI memory — MemexAI',
  description:
    'How AI tutors and personalized learning products use MemexAI to build a learner profile that grows with the student — and stays correctable by teachers, parents, and the student themselves.',
  alternates: { canonical: '/use-cases/edtech-ai' },
  openGraph: {
    title: 'EdTech AI memory — MemexAI',
    description:
      "An AI tutor that remembers how this student learns. MemexAI stores learner profiles as inspectable files — correctable by teachers, parents, and students, not locked in an opaque model.",
    url: 'https://memexai.space/use-cases/edtech-ai',
  },
}

export default function EdTechAIPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">EdTech AI</div>
          <h1>An AI tutor that actually remembers how this student learns.</h1>
          <p className="section-lede">
            Personalized learning only works if the AI carries forward what it learned about each student. MemexAI
            stores learner profiles as human-readable files — growing with every session, correctable by teachers and
            parents, and never locked inside an opaque model.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/quickstart/docker-service">
              Start with Docker
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/use-cases">
              <ArrowLeft size={15} aria-hidden />
              All use cases
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">The problem</div>
        <h2>Personalization that resets every session isn't personalization.</h2>
        <div className="split">
          <div className="path-panel">
            <p>
              The promise of an AI tutor is that it learns how this student works: which explanation style clicks for
              them, where their conceptual gaps are, what they've already mastered, what they gave up on last week. That
              profile is the whole product. Without it, you have a smart chatbot that happens to answer math questions.
            </p>
            <p style={{ marginTop: 14 }}>
              Most AI tutors accumulate this context but can't surface it. Ask the system what it knows about a
              specific student and you get silence or a summary that can't be verified. Ask it to correct a wrong belief
              — "she's actually strong at fractions, she just struggles with word problems" — and there's no clear path
              to make that correction stick.
            </p>
            <p style={{ marginTop: 14 }}>
              For parents and teachers, this opacity is a dealbreaker. They're not just consumers of the AI's output —
              they're co-educators with context the AI doesn't have. A system that accepts their input but hides its
              model of the student loses their trust and their engagement.
            </p>
          </div>
          <div className="path-panel">
            <p>
              The correction problem matters more in education than almost anywhere else. A wrong belief about a
              student — "struggles with algebra" when the real issue is notation, not algebra — shapes every subsequent
              session. If that belief can't be corrected by the teacher who knows the student, the AI compounds the
              error over time.
            </p>
            <p style={{ marginTop: 14 }}>
              Scale makes this worse. A tutoring platform with ten thousand students can't rely on incidental correction
              through conversation. When a teacher needs to update a student's profile — they changed learning pace,
              they were misassessed on a skill, they have a new accommodation — there needs to be a surface where that
              correction happens and sticks.
            </p>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">How MemexAI fits</div>
        <h2>A learner profile teachers can read. Students can question. Parents can trust.</h2>
        <div className="split">
          <div className="path-panel">
            <h3>What the tutor writes</h3>
            <p>
              As the AI tutor works through sessions, it builds a structured learner profile in memory files: skills
              mastered and in-progress, preferred explanation styles, recurring difficulty patterns, pacing notes. Each
              session adds to the profile — it never resets.
            </p>
            <pre>{`// After a math session
await memory_remember({
  content: \`## Learner profile — Maya
Strong: fractions, basic algebra
Working on: word problems (parses correctly, struggles with setup)
Responds well to: visual diagrams, real-world examples
Avoids: timed exercises (anxiety)
Last session: covered ratio problems — needs another pass on
  multi-step ratios before moving to proportions\`,
  path: "user/learner-profile.md"
})`}</pre>
          </div>
          <div className="path-panel">
            <h3>What teachers and parents can do</h3>
            <p>
              The admin console shows every student's memory files in plain language. A teacher who knows a student's
              situation better than the AI can open the profile, correct a wrong assessment, and add context the AI
              couldn't have learned from sessions alone: "she's been tested for dyslexia, prefers audio explanations."
            </p>
            <p style={{ marginTop: 14 }}>
              Revision history shows every change to a learner profile — when a skill was marked mastered, when a
              difficulty was first noted, when a teacher corrected something. For parents asking "how does the system
              think my child is progressing?", the answer is an actual file they can read.
            </p>
            <p style={{ marginTop: 14 }}>
              Shared files under <code>shared/</code> hold curriculum guidelines, grade-level expectations, and
              pedagogical policies. Update the curriculum once and every tutor session in your deployment reflects the
              change — no redeployment, no per-student prompt updates.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you actually get</div>
        <h2>Personalization that earns trust because it can be verified.</h2>
        <div className="trust-list">
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Learner profiles grow with every session — skills, gaps, pacing, style preferences all persist.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Teachers can correct the AI's model of a student directly — wrong assessment fixed in one edit.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Revision history gives parents a verifiable record of what the AI knows and when it learned it.</span>
          </div>
          <div>
            <ShieldCheck size={20} aria-hidden />
            <span>Curriculum and pedagogy in shared memory update once and propagate to all student sessions.</span>
          </div>
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">Docs</div>
        <h2>Go deeper.</h2>
        <div className="uc-links">
          <Link href="/docs/concepts/memory-tools" className="uc-link">
            Memory tools <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/revisions" className="uc-link">
            Revisions <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/concepts/shared-memory" className="uc-link">
            Shared memory <ArrowRight size={13} aria-hidden />
          </Link>
          <Link href="/docs/operations/admin-console" className="uc-link">
            Admin console <ArrowRight size={13} aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  )
}
