# Capture 6 Gallery-Ready Admin UI Screenshots
**Priority:** P0
**Type:** docs
**Status:** [x] done

## What
Capture launch screenshots from a verified Docker stack with seeded memory data.

## Setup
- Ran Docker service on `http://localhost:18081` because `18080` was already allocated locally.
- Seeded `demo_user` with demo-agent smoke data and two `user/profile.md` writes.
- Verified the admin UI with `agent-browser`.

## Screenshots
- `docs/gtm/product-hunt-launch/screenshots/01-admin-profile-file.png` — Files view with `users/demo_user/profile.md`.
- `docs/gtm/product-hunt-launch/screenshots/02-profile-revisions.png` — file-level revision history with two writes.
- `docs/gtm/product-hunt-launch/screenshots/03-profile-activity.png` — file-level activity/access observability.
- `docs/gtm/product-hunt-launch/screenshots/04-observability.png` — observability dashboard.
- `docs/gtm/product-hunt-launch/screenshots/05-tool-playground.png` — tool playground.
- `docs/gtm/product-hunt-launch/screenshots/06-dreams.png` — Dreams operations panel.

## Verification
- All screenshots are 1440x1000 PNGs.
- Visually inspected the profile-file and revisions screenshots.
- Admin UI showed the seeded memory content, revision count, and read/write activity.
