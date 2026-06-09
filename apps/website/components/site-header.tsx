'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { ArrowRight, ChevronDown, Menu, MessageCircle, Star, X } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { slackUrl } from '@/lib/links'

const GITHUB_URL = 'https://github.com/Spotlight-CX/memexai'

const compareItems = [
  { label: 'All comparisons', href: '/compare', sub: 'Overview table' },
  { label: 'vs Mem0', href: '/compare/mem0', sub: 'Retrieval vs file memory' },
  { label: 'vs Zep', href: '/compare/zep', sub: 'Graph vs Postgres' },
  { label: 'vs Vector DB', href: '/compare/vector-database', sub: 'Semantic search vs durable facts' },
  { label: 'vs DIY Postgres', href: '/compare', sub: 'What MemexAI adds over rolling your own' },
]

const docsItems = [
  { label: 'Quickstart', href: '/docs/quickstart/docker-service', sub: 'Docker in 5 minutes' },
  { label: 'Architecture', href: '/docs/architecture', sub: 'Two modes, one schema' },
  { label: 'Memory tools', href: '/docs/concepts/memory-tools', sub: 'remember, context, raw tools' },
  { label: 'Adapters', href: '/docs/adapters/vercel-ai', sub: 'Vercel AI, LangChain, ADK...' },
  { label: 'Shared memory', href: '/docs/concepts/shared-memory', sub: 'Global agent guidance' },
  { label: 'Admin console', href: '/docs/operations/admin-console', sub: 'Inspect and correct memory' },
]

function NavDropdown({
  label,
  href,
  items,
}: {
  label: string
  href: string
  items: { label: string; href: string; sub: string }[]
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelId = `nav-dropdown-${label.toLowerCase().replace(/\s+/g, '-')}`

  function onEnter() {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
  }

  function onLeave() {
    timer.current = setTimeout(() => setOpen(false), 120)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v) }
  }

  return (
    <div
      className="mx-nav-dropdown"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <Link
        href={href}
        className="mx-header-link mx-header-link-chevron"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onKeyDown={onKeyDown}
      >
        {label}
        <ChevronDown size={13} aria-hidden className={open ? 'chevron-open' : ''} />
      </Link>
      {open && (
        <div id={panelId} className="mx-dropdown-panel" role="menu">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mx-dropdown-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className="mx-dropdown-label">{item.label}</span>
              <span className="mx-dropdown-sub">{item.sub}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="mx-header">
      <div className="mx-header-inner">
        <BrandMark size="nav" />

        <nav className="mx-header-nav" aria-label="Main navigation">
          <NavDropdown label="Docs" href="/docs" items={docsItems} />
          <Link href="/use-cases" className="mx-header-link">Use Cases</Link>
          <NavDropdown label="Compare" href="/compare" items={compareItems} />
          <Link href="/blog" className="mx-header-link">Blog</Link>
          <Link href="/roadmap" className="mx-header-link">Roadmap</Link>
        </nav>

        <div className="mx-header-actions">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-header-github mx-tooltip-wrap"
            aria-label="Star on GitHub"
            data-tooltip="Star on GitHub"
          >
            <Star size={13} aria-hidden />
            <span>Star</span>
          </a>
          <a
            href={slackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-header-slack mx-tooltip-wrap"
            aria-label="Join Slack community"
            data-tooltip="Join Slack"
          >
            <MessageCircle size={15} aria-hidden />
          </a>
          <Link href="/docs/quickstart/docker-service" className="mx-btn mx-btn-primary mx-btn-sm">
            Get started
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>

        <button
          className="mx-header-mobile-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="mx-mobile-nav">
          <Link href="/docs" className="mx-mobile-link" onClick={() => setOpen(false)}>Docs</Link>
          <Link href="/use-cases" className="mx-mobile-link" onClick={() => setOpen(false)}>Use Cases</Link>
          <Link href="/compare" className="mx-mobile-link" onClick={() => setOpen(false)}>Compare</Link>
          <Link href="/blog" className="mx-mobile-link" onClick={() => setOpen(false)}>Blog</Link>
          <Link href="/roadmap" className="mx-mobile-link" onClick={() => setOpen(false)}>Roadmap</Link>
          <div className="mx-mobile-social">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="mx-header-github">
              <Star size={13} aria-hidden />
              <span>Star on GitHub</span>
            </a>
            <a href={slackUrl} target="_blank" rel="noopener noreferrer" className="mx-header-slack mx-header-slack-wide">
              <MessageCircle size={15} aria-hidden />
              <span>Join Slack</span>
            </a>
          </div>
          <Link
            href="/docs/quickstart/docker-service"
            className="mx-btn mx-btn-primary"
            onClick={() => setOpen(false)}
          >
            Get started
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      )}
    </header>
  )
}
