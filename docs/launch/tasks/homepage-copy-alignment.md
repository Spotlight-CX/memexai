# Align Homepage Hero to Launch Tagline
**Priority:** P0
**Type:** copy-update
**Status:** [x] done

## What
Read the current hero section of `memexai.space` (in `apps/website/`). Verify the headline and subhead match the launch tagline and thesis. If the homepage still has older or generic copy, update it to match. PH traffic landing on a mismatched hero is a silent conversion killer — visitors expect the page to confirm the promise they clicked on.

Target copy:
- **Headline:** "Inspectable memory for AI agents" or "Persistent memory for AI agents, backed by Postgres"
- **Subhead:** Should surface "AI memory should be product data" or "your team can inspect, correct, and review"
- **Primary CTA:** Should point to Docker quickstart or `setup.md`, not a vague "learn more"

## Files
- `apps/website/` — find the homepage component (likely `app/page.tsx` or `app/(home)/page.tsx`)
- Update hero headline, subhead, and primary CTA if they don't match

## Done when
- Homepage hero headline is one of the two target taglines (verbatim or very close)
- Subhead includes "product data" or "inspect / correct / review" framing
- Primary CTA links to the Docker quickstart or `setup.md`
- `bun run build` passes with no type errors after the change

## Verification
- Updated homepage headline to `Inspectable memory for AI agents`.
- Updated subhead to frame memory as product data the team can inspect, correct, and review in Postgres.
- Updated primary CTA to `/docs/quickstart/docker-service`.
- Ran `bun run build:website` successfully.
