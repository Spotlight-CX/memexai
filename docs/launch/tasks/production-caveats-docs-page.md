# Create Public Production Caveats Docs Page
**Priority:** P1
**Type:** docs
**Status:** [ ] not started

## What
Create a public-facing docs page at `apps/website/content/docs/operations/production-caveats.mdx`. This mirrors `gtm/product-hunt-launch/production-caveats.md` but is written for a public technical audience. The reply bank links to docs when the infra engineer asks hard questions — if the page doesn't exist at launch, the reply falls flat.

**Dependency:** Complete `production-caveats.md` (internal GTM doc) first. Use it as the source of truth for content.

## Files
- Create: `apps/website/content/docs/operations/production-caveats.mdx`
- Update: `apps/website/content/docs/operations/` navigation/sidebar config to include the new page (check how other operations pages are added)

## Content Structure
```mdx
---
title: Production Considerations
description: Honest early-stage limits to review before deploying MemexAI in production.
---

# Production Considerations

MemexAI's core loop is working and self-hosted deployments are running. Before using it in production, review these known constraints:

## Concurrent writes
...

## Revision and access log growth
...

## Search language support
...

## Dreaming token cost
...

## What we're working on
Link to roadmap.
```

## Done when
- Page exists at `apps/website/content/docs/operations/production-caveats.mdx`
- Page appears in the docs sidebar under Operations
- Page is navigable locally (`bun run dev` → `/docs/operations/production-caveats`)
- All 4 gaps from the internal doc are covered with honest language
