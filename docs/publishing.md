# Publishing MemexAI

This repo publishes three npm packages:

- `@memexai/core` from `packages/core`
- `@memexai/sdk` from `packages/sdk`
- `@memexai/admin` from `packages/admin-cli`

`apps/service` and `apps/demo-agent` are private and are not published to npm.

## Preflight

Run this from the repo root before every release:

```bash
bun install
bun test
bun run build
git status --short
```

Only publish from a clean working tree. The root package is private, so publish package directories individually.

## One Command Publish

Build everything and publish all public packages in dependency order:

```bash
bun run publish:packages
```

Preview the exact package publish without writing to npm:

```bash
bun run publish:packages:dry-run
```

The script runs tests, builds the repo, stages each package in a temporary directory, rewrites local `workspace:*` dependencies to the release version for npm, then publishes:

1. `@memexai/core`
2. `@memexai/sdk`
3. `@memexai/admin`

Useful environment options:

```bash
NPM_TAG=next bun run publish:packages
NPM_OTP=123456 bun run publish:packages
PUBLISH_SKIP_TESTS=1 bun run publish:packages
PUBLISH_DRY_RUN=1 bun run publish:packages
PUBLISH_KEEP_STAGE=1 bun run publish:packages:dry-run
```

## Quick Version Bumps

Patch release for all public packages:

```bash
bun pm version patch --cwd packages/core
bun pm version patch --cwd packages/sdk
bun pm version patch --cwd packages/admin-cli
```

Minor release:

```bash
bun pm version minor --cwd packages/core
bun pm version minor --cwd packages/sdk
bun pm version minor --cwd packages/admin-cli
```

Set an exact version:

```bash
bun pm version 0.1.1 --cwd packages/core
bun pm version 0.1.1 --cwd packages/sdk
bun pm version 0.1.1 --cwd packages/admin-cli
```

Commit the version bump:

```bash
git add packages/core/package.json packages/sdk/package.json packages/admin-cli/package.json bun.lock
git commit -m "Bump packages to 0.1.1"
```

## Publish Order

Publish dependency packages first:

```bash
cd packages/core
bun publish --access public

cd ../sdk
bun publish --access public

cd ../admin-cli
bun publish --access public
```

Why this order:

- `@memexai/admin` depends on `@memexai/core`.
- `@memexai/sdk` does not depend on `@memexai/core`, but it should stay version-aligned for v1.

Each package has `prepublishOnly`, so `bun publish` builds before publishing.

## Fast Patch Path

For a small fix when tests are already green:

```bash
bun test
bun run build

bun pm version patch --cwd packages/core
bun pm version patch --cwd packages/sdk
bun pm version patch --cwd packages/admin-cli

git add packages/core/package.json packages/sdk/package.json packages/admin-cli/package.json bun.lock
git commit -m "Bump packages"

(cd packages/core && bun publish --access public)
(cd packages/sdk && bun publish --access public)
(cd packages/admin-cli && bun publish --access public)
```

## After Publishing

Create and push a git tag:

```bash
VERSION=$(node -p "require('./packages/core/package.json').version")
git tag "v$VERSION"
git push origin HEAD
git push origin "v$VERSION"
```

Smoke check npm metadata:

```bash
npm view @memexai/core version
npm view @memexai/sdk version
npm view @memexai/admin version
```

Smoke install in a temporary directory:

```bash
mkdir -p /tmp/memexai-publish-smoke
cd /tmp/memexai-publish-smoke
npm init -y
npm install @memexai/core @memexai/sdk @memexai/admin
node -e "import('@memexai/core').then(m => console.log(Object.keys(m)))"
```

## Notes

- Keep public package versions aligned unless there is a deliberate reason not to.
- Do not publish from `apps/service`; Docker/image publishing should be handled separately.
- Do not publish with local `workspace:*` dependencies unresolved. If npm rejects a package because of `workspace:*`, replace internal published package ranges with the release version before publishing.
