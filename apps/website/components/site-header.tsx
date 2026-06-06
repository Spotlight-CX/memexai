'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'

const navLinks = [
  { label: 'Docs', href: '/docs' },
  { label: 'Compare', href: '/compare' },
  { label: 'Blog', href: '/blog' },
  { label: 'Roadmap', href: '/roadmap' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="mx-header">
      <div className="mx-header-inner">
        <BrandMark size="nav" />

        <nav className="mx-header-nav" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="mx-header-link">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mx-header-actions">
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
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="mx-mobile-link"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
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
