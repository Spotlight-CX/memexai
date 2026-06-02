import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  Database,
  Eye,
  FileClock,
  FolderTree,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Admin Console',
  description:
    'Inspect, correct, and operate MemexAI memory files, revisions, access logs, observability, tool calls, and background dreaming.',
  alternates: {
    canonical: '/admin-console',
  },
  openGraph: {
    title: 'MemexAI Admin Console',
    description:
      'A Postgres-backed console for inspecting AI memory files, revisions, access logs, observability, tool calls, and background dreaming.',
    url: 'https://memexai.space/admin-console',
  },
};

const consoleAreas = [
  {
    icon: FolderTree,
    title: 'Memory files',
    text: 'Browse scoped memory as a tree, open user and shared files, inspect Markdown content, and edit incorrect memory with a reason.',
    why: 'Memory that affects behavior should be readable by the team operating the product.',
  },
  {
    icon: BarChart3,
    title: 'Observability',
    text: 'Track tool calls, p95 latency, error rate, active scopes, hot files, memory topology, hygiene signals, and recent slow or failed calls.',
    why: 'Once memory is injected into prompts, memory health becomes part of debugging production behavior.',
  },
  {
    icon: FileClock,
    title: 'Revisions',
    text: 'Review every write snapshot with actor, operation, reason, timestamp, and the file content that changed future agent behavior.',
    why: 'A wrong answer should lead to a trail, not a guessing game about model state.',
  },
  {
    icon: Activity,
    title: 'Access logs',
    text: 'See read, write, patch, search, and smart-read activity so operators can understand which memory files agents touched.',
    why: 'Trust improves when teams can see what context was actually read, not only what the prompt intended.',
  },
  {
    icon: PlayCircle,
    title: 'Tool playground',
    text: 'In a local or private operator session, call memory tools from the console, test raw and agentic flows, inspect responses, and copy integration snippets.',
    why: 'The first proof should be concrete before a team invests in a full integration.',
  },
  {
    icon: Brain,
    title: 'Dreaming operations',
    text: 'Configure background consolidation, inspect per-user dream status, pause users, and review dream-agent activity before widening rollout.',
    why: 'Background cleanup is useful only if operators can review and pause it.',
  },
];

const philosophy = [
  {
    icon: Database,
    title: 'Memory is product data',
    text: 'If stored memory changes a user experience, it deserves the same operational treatment as profiles, entitlements, billing state, or support notes: inspectable, editable, and accountable.',
  },
  {
    icon: Eye,
    title: 'Trust comes from visibility',
    text: 'The console exists because durable memory should not be explained as "the model remembered." Teams need to see the file, the read, the write, and the revision behind behavior.',
  },
  {
    icon: ShieldCheck,
    title: 'Correction beats mystery',
    text: 'Wrong memory should become an ordinary product workflow: find the record, correct it with a reason, verify the next context, and keep the trail for review.',
  },
];

const proofSteps = [
  'Run the Docker service',
  'Write one durable memory',
  'Open the admin console',
  'Inspect the file, revisions, and access logs',
  'Use observability to see memory activity',
];

const screenshots = [
  {
    src: '/images/admin-console/observability-context.png',
    title: 'Observability context',
    text: 'Read memory topology, hygiene signals, evolution, activity, hot files, and recent slow calls in one operator view.',
  },
  {
    src: '/images/admin-console/files.png',
    title: 'Files',
    text: 'Open a user memory file and read the durable facts that the next agent response can use.',
  },
  {
    src: '/images/admin-console/revisions.png',
    title: 'Revisions',
    text: 'See the write trail behind a file, including actors and correction reasons.',
  },
  {
    src: '/images/admin-console/playground.png',
    title: 'Tool Playground',
    text: 'Exercise memory tools without writing a full app integration first.',
  },
];

export default function AdminConsolePage() {
  return (
    <main className="site-shell">
      <section className="page-hero admin-console-hero">
        <div className="section admin-console-hero-inner">
          <div>
            <div className="eyebrow">
              <Database size={15} aria-hidden />
              Memory as an operating surface
            </div>
            <h1>Inspect and operate AI memory from the admin console.</h1>
            <p className="section-lede">
              MemexAI does not hide memory in an opaque model layer. The admin console gives teams a place to inspect
              memory files, correct wrong facts, review revisions, follow access logs, test tools, and watch memory
              health across users.
            </p>
            <p className="admin-console-security-note">
              The console is an operator surface, not an end-user app. Put <code>/admin</code> behind your own auth,
              keep <code>MEMEX_ADMIN_SECRET</code> and <code>MEMEX_API_KEY</code> server-side, and proxy admin calls in
              public deployments.
            </p>
            <div className="hero-actions">
              <Link className="site-button site-button-primary" href="/docs/operations/admin-console">
                Read the admin docs
                <ArrowRight size={17} aria-hidden />
              </Link>
              <Link className="site-button site-button-secondary" href="/docs/quickstart/docker-service">
                Run with Docker
              </Link>
            </div>
          </div>
          <figure className="admin-console-main-shot">
            <img src="/images/admin-console/observability.png" alt="MemexAI admin observability dashboard showing memory health, topology, activity, latency, and top files." />
          </figure>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Philosophy</div>
        <h2>Memory should be operable, not magical.</h2>
        <p className="section-lede">
          MemexAI is built around a simple belief: once memory can affect the next answer, it is no longer just model
          context. It is part of the product surface. The admin console is where that surface becomes visible enough for
          real teams to trust, debug, and improve it.
        </p>
        <div className="admin-console-philosophy">
          {philosophy.map((item) => {
            const Icon = item.icon;
            return (
              <article className="admin-console-principle" key={item.title}>
                <Icon size={21} aria-hidden />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">What you can do</div>
        <h2>The console covers the core memory operating loop.</h2>
        <p className="section-lede">
          Use it after first install to prove the loop, and in production-like environments to debug why an agent
          remembered, forgot, or changed a durable fact after you have reviewed the security and retention caveats.
        </p>
        <div className="admin-console-grid">
          {consoleAreas.map((area) => {
            const Icon = area.icon;
            return (
              <article className="admin-console-card" key={area.title}>
                <Icon size={21} aria-hidden />
                <h3>{area.title}</h3>
                <p>{area.text}</p>
                <strong>{area.why}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section contrast-section">
        <div className="section-kicker">90-second proof</div>
        <h2>Make the memory loop visible before you integrate.</h2>
        <div className="admin-console-proof">
          {proofSteps.map((step, index) => (
            <div className="loop-step" key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Screens</div>
        <h2>Memory is visible, revisioned, and testable.</h2>
        <div className="admin-console-shot-grid">
          {screenshots.map((shot) => (
            <figure className="admin-console-shot" key={shot.title}>
              <img src={shot.src} alt={`MemexAI admin console ${shot.title} screen.`} />
              <figcaption>
                <strong>{shot.title}</strong>
                <span>{shot.text}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div className="section">
          <div className="section-kicker">Operations</div>
          <h2>Wrong memory should be fixable by opening the record.</h2>
          <p className="section-lede">
            The admin console turns memory into product data: a team can inspect what exists, correct it, verify the
            next prompt context, and keep the audit trail.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/operations/correction-workflow">
              Correction workflow
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/docs/operations/production-caveats">
              Production considerations
            </Link>
          </div>
        </div>
      </section>

      <section className="section roadmap-note">
        <ShieldCheck size={20} aria-hidden />
        <p>
          The admin console is included with the service container at <code>/admin</code>. Keep admin access behind your
          own authentication and treat the admin secret as server-side operational credential.
        </p>
      </section>
    </main>
  );
}
