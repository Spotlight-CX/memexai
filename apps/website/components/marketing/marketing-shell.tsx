'use client'

import { useCursorAura } from '@/components/marketing/use-cursor-aura'
import { useLenis } from '@/components/marketing/use-lenis'
import { SiteHeader } from '@/components/site-header'

export function MarketingShell({ children }: { children: React.ReactNode }) {
  useCursorAura()
  useLenis()

  return (
    <div className="mx-shell">
      <SiteHeader />
      {children}
    </div>
  )
}
