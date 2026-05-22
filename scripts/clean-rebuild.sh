#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="${BUN_REGISTRY:-https://registry.npmmirror.com}"
ASSUME_YES=false

usage() {
  cat <<'EOF'
Usage: scripts/clean-rebuild.sh [--yes]

Stops Docker Compose, removes Compose volumes, rebuilds the service image,
and starts the stack again.

Options:
  -y, --yes    Skip the destructive volume-removal confirmation.
  -h, --help   Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    -y|--yes)
      ASSUME_YES=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

cd "$ROOT_DIR"

if [[ "$ASSUME_YES" != "true" ]]; then
  read -r -p "This will delete Docker Compose volumes, including Postgres data. Continue? [y/N] " answer
  case "$answer" in
    y|Y|yes|YES)
      ;;
    *)
      echo "Cancelled."
      exit 0
      ;;
  esac
fi

echo "Installing dependencies with Bun registry: $REGISTRY"
bun install --frozen-lockfile --registry="$REGISTRY"

echo "Stopping Docker Compose services and removing volumes..."
docker compose down --volumes --remove-orphans

echo "Rebuilding and starting Docker Compose services..."
docker compose up -d --build

echo "Done. Admin should be available at http://localhost:${MEMEX_PORT:-8080}/admin"
