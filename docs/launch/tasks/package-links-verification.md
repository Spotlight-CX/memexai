# Verify All Package Links Are Live
**Priority:** P0
**Type:** code
**Status:** [ ] not started

## What
Verify that npm, PyPI, and Docker Hub package links in the README resolve to real, current published packages. Version numbers should match the latest code. A broken badge or stale version on launch day is an immediate credibility gap — an infra engineer will check these within 30 seconds of reading the README.

## Files
- `README.md` — inspect all badge URLs and package links
- Verify each resolves to a live artifact

## Steps
1. Open `README.md` and extract all package badge URLs and install command links
2. For npm: `npm view @memexai/core version` and `npm view @memexai/sdk version` — must match `package.json` version in repo
3. For PyPI: `pip index versions memexai` or check PyPI URL — must exist and match latest
4. For Docker Hub: `docker manifest inspect memexai/memexai:latest` — must resolve
5. If any link is broken or stale, either publish the updated package or update README to correct version
6. Check that `https://github.com/Spotlight-CX/memexai` resolves (PH listing links here)

## Done when
- Every npm/PyPI/Docker badge in README links to a real published artifact
- Published versions are not more than 2 weeks behind the repo's latest tag or `main`
- GitHub URL resolves to a public repo
