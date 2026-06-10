#!/usr/bin/env bash
set -euo pipefail

# Deploy memexai-demo to Cloud Run
# Usage: bash scripts/deploy-cloudrun.sh [--build]
#
# Reads from project root .env:
#   DEMO_DATABASE_URL  - Neon postgres connection string
#   MEMEX_API_KEY      - agent API key shared with SDK clients
#   MEMEX_ADMIN_SECRET - admin UI secret
#   GCP_PROJECT        - GCP project ID
#   GCP_REGION         - GCP region (default: asia-southeast1 — co-located with Neon ap-southeast-1)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"

# ── Load .env (safe parser — handles unquoted values with spaces) ────────────
load_env_var() {
  local key="$1"
  local val
  val=$(grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed "s/^[\"']//" | sed "s/[\"']$//")
  [[ -n "$val" ]] && export "${key}=${val}"
}
if [[ -f "$ENV_FILE" ]]; then
  for var in DEMO_DATABASE_URL MEMEX_API_KEY MEMEX_ADMIN_SECRET GCP_PROJECT GCP_REGION; do
    load_env_var "$var"
  done
fi

# ── Config ──────────────────────────────────────────────────────────────────
SERVICE_NAME="${SERVICE_NAME:-memexai-demo}"
GCP_REGION="${GCP_REGION:-asia-southeast1}"
IMAGE="${IMAGE:-asia-southeast1-docker.pkg.dev/memexai-demo/memexai/service:latest}"

# ── Validate required vars ──────────────────────────────────────────────────
missing=()
[[ -z "${GCP_PROJECT:-}" ]]        && missing+=("GCP_PROJECT")
[[ -z "${DEMO_DATABASE_URL:-}" ]]  && missing+=("DEMO_DATABASE_URL")
[[ -z "${MEMEX_API_KEY:-}" ]]      && missing+=("MEMEX_API_KEY")
[[ -z "${MEMEX_ADMIN_SECRET:-}" ]] && missing+=("MEMEX_ADMIN_SECRET")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: Missing required env vars: ${missing[*]}"
  echo "Add them to .env or export before running."
  exit 1
fi

BUILD=false
for arg in "$@"; do [[ "$arg" == "--build" ]] && BUILD=true; done

echo "==> Project:  $GCP_PROJECT"
echo "==> Region:   $GCP_REGION"
echo "==> Service:  $SERVICE_NAME"
echo "==> Image:    $IMAGE"
echo ""

# ── Set GCP project ─────────────────────────────────────────────────────────
gcloud config set project "$GCP_PROJECT"

# ── Enable APIs ─────────────────────────────────────────────────────────────
echo "==> Enabling APIs..."
gcloud services enable run.googleapis.com secretmanager.googleapis.com --quiet

# ── Optional: build + push to Artifact Registry ─────────────────────────────
if [[ "$BUILD" == "true" ]]; then
  REPO="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/memexai"
  IMAGE="$REPO/service:latest"
  echo "==> Creating Artifact Registry repo (if needed)..."
  gcloud artifacts repositories create memexai \
    --repository-format=docker \
    --location="$GCP_REGION" \
    --quiet 2>/dev/null || true
  gcloud auth configure-docker "$GCP_REGION-docker.pkg.dev" --quiet
  echo "==> Building image..."
  docker build -t "$IMAGE" "$ROOT_DIR"
  echo "==> Pushing image..."
  docker push "$IMAGE"
fi

# ── Upsert secrets ───────────────────────────────────────────────────────────
upsert_secret() {
  local name="$1"
  local value="$2"
  if gcloud secrets describe "$name" --quiet 2>/dev/null; then
    echo "==> Updating secret: $name"
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- --quiet
  else
    echo "==> Creating secret: $name"
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --quiet
  fi
}

upsert_secret "memexai-demo-database-url"  "$DEMO_DATABASE_URL"
upsert_secret "memexai-demo-api-key"       "$MEMEX_API_KEY"
upsert_secret "memexai-demo-admin-secret"  "$MEMEX_ADMIN_SECRET"

# ── Grant Cloud Run service account access to secrets ───────────────────────
PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT" --format="value(projectNumber)")
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "==> Granting secret access to: $SA"
for secret in memexai-demo-database-url memexai-demo-api-key memexai-demo-admin-secret; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet 2>/dev/null || true
done

# ── Deploy ───────────────────────────────────────────────────────────────────
echo "==> Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$GCP_REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 3 \
  --set-secrets "DATABASE_URL=memexai-demo-database-url:latest,MEMEX_API_KEY=memexai-demo-api-key:latest,MEMEX_ADMIN_SECRET=memexai-demo-admin-secret:latest" \
  --quiet

# ── Print result ─────────────────────────────────────────────────────────────
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$GCP_REGION" \
  --format="value(status.url)")

echo ""
echo "✓ Deployed: $SERVICE_URL"
echo "  Health:   $SERVICE_URL/health"
echo "  Admin UI: $SERVICE_URL/admin"
echo ""
echo "─── Domain mapping ──────────────────────────────────────────────────────"
echo ""
echo "To map demo.memexai.space, run:"
echo ""
echo "  gcloud run domain-mappings create \\"
echo "    --service $SERVICE_NAME \\"
echo "    --domain demo.memexai.space \\"
echo "    --region $GCP_REGION"
echo ""
echo "Then add this DNS record at your registrar:"
echo "  Type:  CNAME"
echo "  Name:  demo"
echo "  Value: ghs.googlehosted.com."
echo ""
echo "Cloud Run uses SNI-based routing — a CNAME to ghs.googlehosted.com is correct."
echo "No ANAME/ALIAS needed. Propagation takes 5–30 min."
echo "TLS certificate is provisioned automatically by Google."
