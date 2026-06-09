import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Code2,
  Database,
  GitBranch,
  HeadphonesIcon,
  Layers,
  Search,
  Shield,
  Users,
  Wrench,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Use Cases — MemexAI',
  description:
    'How teams use MemexAI to build AI products where memory is a first-class product surface: inspectable, correctable, and durable across sessions.',
  alternates: {
    canonical: '/use-cases',
  },
  openGraph: {
    title: 'Use Cases — MemexAI',
    description:
      'How teams build AI products with inspectable, correctable memory infrastructure using MemexAI.',
    url: 'https://memexai.space/use-cases',
  },
}

const useCases = [
  {
    icon: Users,
    tag: 'Multi-tenant SaaS',
    title: 'Per-user memory that your ops team can inspect and fix',
    problem:
      'When an agent behaves differently for two users, you need to understand why. Most memory tools give you a retrieval API, not a correction surface.',
    solution:
      "MemexAI scopes memory per tenant with physical path isolation. Every write creates a revision. Your support or ops team can open a user's memory files, fix wrong facts, and see exactly what the agent learned and when. Memory becomes a product data surface you operate, not a black box you deploy.",
    links: [
      { label: 'Scopes and isolation', href: '/docs/concepts/scopes' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
      { label: 'Admin console', href: '/docs/operations/admin-console' },
    ],
  },
  {
    icon: Code2,
    tag: 'Code agents',
    title: 'Project-scoped memory that outlives a context window',
    problem:
      'Code agents forget architectural decisions, learned API quirks, and recurring error patterns between sessions. Re-discovery is slow and expensive.',
    solution:
      'Store project-level facts in structured memory files: API constraints, stack preferences, common failure modes, previous decisions. The agent carries forward what it learned — not just the prompt, but the accumulated working knowledge for this specific repository.',
    links: [
      { label: 'Shared memory', href: '/docs/concepts/shared-memory' },
      { label: 'Memory tools', href: '/docs/concepts/memory-tools' },
      { label: 'Prompt block', href: '/docs/concepts/prompt-block' },
    ],
  },
  {
    icon: HeadphonesIcon,
    tag: 'Customer support AI',
    title: 'Memory that carries context across tickets and sessions',
    problem:
      "Support agents ask users the same questions session after session. Memory that doesn't persist forces users to repeat themselves and agents to re-establish context from scratch.",
    solution:
      "MemexAI stores stable user facts — product tier, integration setup, known issues — in durable memory files. Each session inherits what the previous one learned. When a fact becomes wrong, support staff correct it directly. Memory stays in sync with the user's actual situation.",
    links: [
      { label: 'How it works', href: '/docs/concepts/how-it-works' },
      { label: 'Access logs', href: '/docs/concepts/access-logs' },
      { label: 'Docker quickstart', href: '/docs/quickstart/docker-service' },
    ],
  },
  {
    icon: BrainCircuit,
    tag: 'Long-horizon agents',
    title: 'Task state that survives across context resets',
    problem:
      'Complex tasks that span days or weeks lose intermediate state when context windows reset. Agents restart from scratch, repeat completed steps, and miss learned constraints.',
    solution:
      'Write task checkpoints, completed sub-goals, and learned constraints into memory files as the agent works. On resumption, the prompt block injects current task state before the first tool call. The agent continues from where it left off, with all hard-won context intact.',
    links: [
      { label: 'Cognitive architecture', href: '/docs/concepts/cognitive-architecture' },
      { label: 'Design principles', href: '/docs/concepts/design-principles' },
      { label: 'Background Dreaming', href: '/docs/operations/dreaming' },
    ],
  },
  {
    icon: Layers,
    tag: 'Multi-agent pipelines',
    title: 'Shared behavioral context across agents in a product',
    problem:
      "When multiple agents handle different parts of a product, coordination policies live in prompts. Changing policy means updating every agent's system prompt and redeploying.",
    solution:
      "MemexAI's shared memory layer provides read-only guidance all agents in your deployment receive automatically. Tool rules, escalation criteria, API limits, and coordination conventions live in one place. Change a shared file and every agent's next call reflects the update — no deployment needed.",
    links: [
      { label: 'Shared memory', href: '/docs/concepts/shared-memory' },
      { label: 'Trust model', href: '/docs/operations/trust-model' },
      { label: 'Prompt block', href: '/docs/concepts/prompt-block' },
    ],
  },
  {
    icon: Wrench,
    tag: 'Agent infrastructure teams',
    title: 'Memory you can debug without guessing what the agent learned',
    problem:
      "Debugging personalization failures is hard when memory is a vector index. You can't tell if the agent failed to write, failed to retrieve, or retrieved and ignored.",
    solution:
      "MemexAI's audit surface separates the failure modes. Access logs show every read and write with tool call IDs. Revisions show every version of every file. You can reconstruct exactly what the agent knew at any point in time and trace wrong behavior back to its cause.",
    links: [
      { label: 'Access logs', href: '/docs/concepts/access-logs' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
      { label: 'Admin console', href: '/docs/operations/admin-console' },
    ],
  },
]

const deploymentModes = [
  {
    icon: Database,
    title: 'Direct Postgres',
    description:
      'Your app owns the database connection. No HTTP layer. Import @memexai/core, call migrate() once, and wire memory tools directly into your model call.',
    tag: 'Serverless · Single-process · Full control',
    href: '/docs/architecture',
  },
  {
    icon: Bot,
    title: 'Docker service',
    description:
      'Run the MemexAI service alongside your app. Clients use @memexai/sdk with an API key. Postgres, the service, and the admin UI all start from one compose file.',
    tag: 'Multi-tenant · Multi-service · Admin UI included',
    href: '/docs/quickstart/docker-service',
  },
  {
    icon: GitBranch,
    title: 'Agent onboarding',
    description:
      'Hand a coding agent the setup file at memexai.space/setup.md and it wires MemexAI into your existing agent project — detecting your stack and adding the right adapter.',
    tag: 'Claude Code · Cursor · Any coding agent',
    href: '/docs/quickstart/agent-onboarding',
  },
]

const principles = [
  {
    icon: Shield,
    title: 'Memory should be correctable',
    body: 'Wrong facts should be editable by your team — not buried in a retrieval index. MemexAI stores memory as files your ops team can open, fix, and verify.',
  },
  {
    icon: Search,
    title: 'Memory should be auditable',
    body: 'Every read and write is logged with a tool call ID. Every file change creates a revision. You can trace any behavior back to the exact memory state that caused it.',
  },
  {
    icon: Layers,
    title: 'Memory should be scoped',
    body: 'Per-user memory is physically isolated. Shared guidance is separate from user facts. Agents never cross tenant boundaries by design.',
  },
]

const frameworks = [
  { label: 'Vercel AI SDK', href: '/docs/adapters/vercel-ai', lang: 'TypeScript' },
  { label: 'Anthropic SDK', href: '/docs/adapters/anthropic', lang: 'TypeScript' },
  { label: 'LangChain', href: '/docs/adapters/langchain', lang: 'Python / TypeScript' },
  { label: 'OpenAI SDK', href: '/docs/adapters/openai', lang: 'TypeScript' },
  { label: 'LlamaIndex', href: '/docs/adapters/llamaindex', lang: 'Python' },
  { label: 'CrewAI', href: '/docs/adapters/crewai', lang: 'Python' },
  { label: 'Google ADK', href: '/docs/adapters/adk', lang: 'Python' },
]

export default function UseCasesPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="section">
          <div className="eyebrow">
            <BrainCircuit size={15} aria-hidden />
            Use cases
          </div>
          <h1>Memory that your team can operate, not just deploy.</h1>
          <p className="section-lede">
            Most memory tools optimize for retrieval quality. MemexAI optimizes for operability — memory that is
            scoped per user, correctable by your team, and auditable when something goes wrong.
          </p>
          <div className="hero-actions">
            <Link className="site-button site-button-primary" href="/docs/quickstart/docker-service">
              Start with Docker
              <ArrowRight size={17} aria-hidden />
            </Link>
            <Link className="site-button site-button-secondary" href="/docs/quickstart/agent-onboarding">
              Let an agent set it up
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Why operability</div>
        <h2>The difference is what happens when memory is wrong.</h2>
        <p className="section-lede">
          Retrieval-first memory is hard to debug when it fails — wrong extraction, retrieval miss, or retrieval
          ignored. MemexAI separates those failure modes by keeping memory as auditable files with full revision
          history and access logs.
        </p>
        <div className="feature-grid">
          {principles.map((p) => {
            const Icon = p.icon
            return (
              <div className="feature" key={p.title}>
                <Icon size={24} aria-hidden />
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            )
          })}
        </div>
      </section>

      {useCases.map((uc, i) => {
        const Icon = uc.icon
        return (
          <section className={`section${i % 2 !== 0 ? ' contrast-section' : ''}`} key={uc.tag}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon size={18} aria-hidden style={{ color: 'var(--site-accent)' }} />
              <span className="section-kicker">{uc.tag}</span>
            </div>
            <h2>{uc.title}</h2>
            <div className="split">
              <div className="path-panel">
                <h3>The problem</h3>
                <p>{uc.problem}</p>
              </div>
              <div className="path-panel">
                <h3>How MemexAI solves it</h3>
                <p>{uc.solution}</p>
              </div>
            </div>
            <div className="uc-links">
              {uc.links.map((l) => (
                <Link key={l.href} href={l.href} className="uc-link">
                  {l.label}
                  <ArrowRight size={13} aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )
      })}

      <section className="section contrast-section">
        <div className="section-kicker">Deployment</div>
        <h2>Pick the integration path that matches your stack.</h2>
        <p className="section-lede">
          MemexAI works in two modes that share the same Postgres schema and tool API. Choose direct Postgres for
          full control, or the Docker service for multi-tenant isolation with an admin UI out of the box.
        </p>
        <div className="feature-grid">
          {deploymentModes.map((mode) => {
            const Icon = mode.icon
            return (
              <Link className="feature link-card" href={mode.href} key={mode.title}>
                <Icon size={24} aria-hidden />
                <h3>{mode.title}</h3>
                <p>{mode.description}</p>
                <span className="small-meta" style={{ marginTop: '12px', display: 'block' }}>
                  {mode.tag}
                </span>
                <span className="text-link">
                  Read the docs
                  <ArrowRight size={13} aria-hidden />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Frameworks</div>
        <h2>Adapters for the frameworks your agents already use.</h2>
        <p className="section-lede">
          MemexAI ships adapters for Vercel AI SDK, Anthropic SDK, LangChain, OpenAI, LlamaIndex, CrewAI, and
          Google ADK — in TypeScript and Python. You keep your existing model SDK and add memory at the agent
          boundary.
        </p>
        <div className="uc-framework-grid">
          {frameworks.map((fw) => (
            <Link key={fw.href} href={fw.href} className="uc-framework-pill">
              <span>{fw.label}</span>
              <span className="uc-lang">{fw.lang}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
