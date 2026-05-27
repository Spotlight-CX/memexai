"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import posthog from "posthog-js"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_MEMEX_TELEMETRY_POSTHOG_KEY || "phc_bv7z3layK9wvAFUY8nUbhcqirWNiOTsy0KSZS2M83Mc"
const POSTHOG_HOST = process.env.NEXT_PUBLIC_MEMEX_TELEMETRY_POSTHOG_HOST || "https://us.i.posthog.com"
let initialized = false

function telemetryEnabled() {
  if (process.env.NEXT_PUBLIC_MEMEX_TELEMETRY_DISABLED === "true") return false
  if (POSTHOG_KEY.includes("REPLACE_WITH")) return false
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_MEMEX_TELEMETRY_DEV !== "true") return false
  return true
}

export function Analytics() {
  const pathname = usePathname()
  const enabled = telemetryEnabled()

  useEffect(() => {
    if (!enabled || initialized) return
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      person_profiles: "identified_only",
    })
    initialized = true
  }, [enabled])

  useEffect(() => {
    if (!enabled || !initialized) return
    posthog.capture("$pageview", { path: pathname })
  }, [enabled, pathname])

  useEffect(() => {
    if (!enabled) return

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-analytics-event]")
        : null
      if (!target || !initialized) return

      posthog.capture(target.dataset.analyticsEvent || "cta_clicked", {
        analytics_label: target.dataset.analyticsLabel,
        href: target instanceof HTMLAnchorElement ? target.href : undefined,
        path: window.location.pathname,
      })
    }

    const onCustomEvent = (event: Event) => {
      if (!initialized || !(event instanceof CustomEvent)) return
      const detail = event.detail as { event?: string; properties?: Record<string, unknown> } | undefined
      if (!detail?.event) return
      posthog.capture(detail.event, {
        ...(detail.properties ?? {}),
        path: window.location.pathname,
      })
    }

    document.addEventListener("click", onClick)
    window.addEventListener("memexai:analytics", onCustomEvent)
    return () => {
      document.removeEventListener("click", onClick)
      window.removeEventListener("memexai:analytics", onCustomEvent)
    }
  }, [enabled])

  return null
}

export function captureAnalyticsEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("memexai:analytics", { detail: { event, properties } }))
}
