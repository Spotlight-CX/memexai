'use client'
import { useEffect } from 'react'

export function useCursorAura() {
  useEffect(() => {
    const shell = document.querySelector('.mx-shell')
    if (!shell) return

    function handleMove(e: MouseEvent) {
      const el = shell as HTMLElement
      el.style.setProperty('--mouse-x', `${e.clientX}px`)
      el.style.setProperty('--mouse-y', `${e.clientY}px`)
    }

    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])
}
