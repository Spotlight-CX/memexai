import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Database,
  GitBranch,
  Layers,
  Search,
  Shield,
} from 'lucide-react'
import { useCases } from '../../lib/use-cases-data'

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
            Most memory tools optimize for retrieval quality. MemexAI optimizes for operability — memory that is scoped
            per user, correctable by your team, and auditable when something goes wrong.
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
          ignored. MemexAI separates those failure modes by keeping memory as auditable files with full revision history
          and access logs.
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

      <section className="section contrast-section">
        <div className="section-kicker">Use cases</div>
        <h2>Fits where memory is a product requirement, not an afterthought.</h2>
        <p className="section-lede">
          From personal assistants to multi-agent pipelines — wherever users or your team need to trust, inspect, or
          correct what the AI remembers.
        </p>
        <div className="feature-grid">
          {useCases.map((uc) => {
            const Icon = uc.icon
            return (
              <Link className="feature link-card" href={`/use-cases/${uc.slug}`} key={uc.slug}>
                <Icon size={24} aria-hidden />
                <span className="small-meta" style={{ display: 'block', marginBottom: '4px' }}>
                  {uc.tag}
                </span>
                <h3>{uc.title}</h3>
                <p>{uc.summary}</p>
                <span className="text-link" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Read more
                  <ArrowRight size={13} aria-hidden />
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-kicker">Deployment</div>
        <h2>Pick the integration path that matches your stack.</h2>
        <p className="section-lede">
          MemexAI works in two modes that share the same Postgres schema and tool API. Choose direct Postgres for full
          control, or the Docker service for multi-tenant isolation with an admin UI out of the box.
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

      <section className="section contrast-section">
        <div className="section-kicker">Frameworks</div>
        <h2>Adapters for the frameworks your agents already use.</h2>
        <p className="section-lede">
          MemexAI ships adapters for Vercel AI SDK, Anthropic SDK, LangChain, OpenAI, LlamaIndex, CrewAI, and Google
          ADK — in TypeScript and Python. You keep your existing model SDK and add memory at the agent boundary.
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
