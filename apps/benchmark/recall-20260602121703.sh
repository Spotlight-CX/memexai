#!/usr/bin/env bash
# Recall-only eval for run 20260602121703.
#
# Usage:
#   ./apps/benchmark/recall-20260602121703.sh
#
# Steps performed:
#   1. Clean-rebuild the Docker stack (wipes volumes, rebuilds image)
#   2. Prompts y/n to restore the ingested pg dump
#   3. Runs recall-only eval against the restored DB

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DUMP_FILE="$SCRIPT_DIR/data/memex-ingested-20260602121703.pgdump"
POSTGRES_PORT="${POSTGRES_PORT:-55433}"
MEMEX_PORT="${MEMEX_PORT:-18080}"
PG_CONTAINER="memexai-postgres-1"

cd "$REPO_ROOT"

# ── Step 1: clean rebuild ──────────────────────────────────────────────────────
echo "=== Step 1: clean rebuild ==="
POSTGRES_PORT="$POSTGRES_PORT" MEMEX_PORT="$MEMEX_PORT" \
  ./scripts/clean-rebuild.sh --yes

# Give Postgres a moment to be ready after fresh start
echo "Waiting for Postgres to be ready..."
for i in $(seq 1 20); do
  if docker exec "$PG_CONTAINER" psql -U memexai -d memexai -c "SELECT 1" &>/dev/null; then
    break
  fi
  sleep 2
done

# ── Step 2: restore dump ───────────────────────────────────────────────────────
echo ""
read -r -p "Restore ingested pg dump into fresh DB? [y/N] " answer
case "$answer" in
  y|Y|yes|YES)
    echo "=== Step 2: restoring dump ==="
    docker exec -i "$PG_CONTAINER" pg_restore \
      -U memexai -d memexai \
      --no-owner --if-exists --clean \
      < "$DUMP_FILE"
    echo "Dump restored."
    ;;
  *)
    echo "Skipped dump restore — running recall against current DB state."
    ;;
esac

# ── Step 3: recall eval ────────────────────────────────────────────────────────
echo ""
echo "=== Step 3: recall eval ==="
MEMEX_PORT="$MEMEX_PORT" bun run bench:docker-smoke -- \
  --run-id 20260602121703 \
  --limit 100 \
  --batch-size 30 \
  --skip-ingest
