#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="${BUN_REGISTRY:-https://registry.npmmirror.com}"
ASSUME_YES=false
RESTORE_DUMP=""
NO_RESTORE=false
DEFAULT_DUMP="apps/benchmark/data/memex-ingested-20260604105900.pgdump"

usage() {
  cat <<'EOF'
Usage: scripts/clean-rebuild.sh [--yes] [--restore-dump <path>] [--no-restore]

Stops Docker Compose, removes Compose volumes, rebuilds the service image,
starts the stack again, and can optionally restore a pg dump.

Options:
  -y, --yes              Skip the destructive volume-removal confirmation.
  --restore-dump <path>  Restore this pg dump after the stack starts.
  --no-restore           Do not ask about restoring a pg dump.
  -h, --help             Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  arg="$1"
  case "$arg" in
    -y|--yes)
      ASSUME_YES=true
      shift
      ;;
    --restore-dump)
      RESTORE_DUMP="${2:-}"
      if [[ -z "$RESTORE_DUMP" ]]; then
        echo "--restore-dump requires a path" >&2
        usage >&2
        exit 2
      fi
      shift 2
      ;;
    --restore-dump=*)
      RESTORE_DUMP="${arg#*=}"
      shift
      ;;
    --no-restore)
      NO_RESTORE=true
      shift
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

if [[ -z "$RESTORE_DUMP" && "$NO_RESTORE" != "true" ]]; then
  echo ""
  read -r -p "Restore a pg dump into the fresh DB now? [y/N] " restore_answer
  case "$restore_answer" in
    y|Y|yes|YES)
      if [[ -f "$DEFAULT_DUMP" ]]; then
        read -r -p "Dump path [$DEFAULT_DUMP]: " restore_path
        RESTORE_DUMP="${restore_path:-$DEFAULT_DUMP}"
      else
        read -r -p "Dump path: " RESTORE_DUMP
      fi
      ;;
    *)
      RESTORE_DUMP=""
      ;;
  esac
fi

if [[ -n "$RESTORE_DUMP" ]]; then
  ./scripts/restore-pgdump.sh "$RESTORE_DUMP"
fi

echo "Done. Admin should be available at http://localhost:${MEMEX_PORT:-8080}/admin"
