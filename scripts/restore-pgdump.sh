#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-memexai}"
POSTGRES_DB="${POSTGRES_DB:-memexai}"

usage() {
  cat <<'EOF'
Usage: scripts/restore-pgdump.sh <dump-file>

Restores a pg dump into the Docker Compose Postgres database.

Environment:
  POSTGRES_SERVICE  Compose service name for Postgres (default: postgres)
  POSTGRES_USER     Database user (default: memexai)
  POSTGRES_DB       Database name (default: memexai)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

DUMP_FILE="${1:-}"
if [[ -z "$DUMP_FILE" ]]; then
  usage >&2
  exit 2
fi

cd "$ROOT_DIR"

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

container_id="$(docker compose ps -q "$POSTGRES_SERVICE")"
if [[ -z "$container_id" ]]; then
  echo "Postgres service is not running: $POSTGRES_SERVICE" >&2
  exit 1
fi

echo "Waiting for Postgres to be ready..."
for _ in $(seq 1 30); do
  if docker compose exec -T "$POSTGRES_SERVICE" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker compose exec -T "$POSTGRES_SERVICE" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
  echo "Postgres did not become ready in time." >&2
  exit 1
fi

case "$DUMP_FILE" in
  *.sql)
    echo "Restoring SQL dump: $DUMP_FILE"
    docker compose exec -T "$POSTGRES_SERVICE" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$DUMP_FILE"
    ;;
  *)
    echo "Restoring custom-format dump: $DUMP_FILE"
    docker compose exec -T "$POSTGRES_SERVICE" pg_restore \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      --no-owner \
      --no-privileges \
      --if-exists \
      --clean \
      < "$DUMP_FILE"
    ;;
esac

echo "Dump restored."
