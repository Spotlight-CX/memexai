#!/usr/bin/env bash
set -euo pipefail

IMAGE="soorajshankar/memexai"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_VERSION="$(node -p "require('$SCRIPT_DIR/../packages/core/package.json').version")"

PUSH_ONLY=false
VERSION=""

for arg in "$@"; do
  case "$arg" in
    --push-only) PUSH_ONLY=true ;;
    *) VERSION="$arg" ;;
  esac
done

VERSION="${VERSION:-$PKG_VERSION}"

TAGS=("$IMAGE:latest")
if [ "$VERSION" != "latest" ]; then
  TAGS+=("$IMAGE:$VERSION")
fi

if [ "$PUSH_ONLY" = true ]; then
  echo "▶ Retagging $IMAGE:latest → $IMAGE:$VERSION (skipping build)..."
  TAG_ARGS=()
  for tag in "${TAGS[@]}"; do
    TAG_ARGS+=(--tag "$tag")
  done
  docker buildx imagetools create "${TAG_ARGS[@]}" "$IMAGE:latest"
else
  echo "▶ Building $IMAGE:$VERSION (linux/amd64 + linux/arm64)..."
  TAG_ARGS=()
  for tag in "${TAGS[@]}"; do
    TAG_ARGS+=(--tag "$tag")
  done
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    "${TAG_ARGS[@]}" \
    --push \
    "$SCRIPT_DIR/.."
fi

echo "✓ Published ${TAGS[*]}"
