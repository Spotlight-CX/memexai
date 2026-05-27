#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCATION="${GOOGLE_VERTEX_LOCATION:-us-central1}"
MODEL="${GOOGLE_VERTEX_MODEL:-gemini-2.5-flash}"
SERVICE_ACCOUNT_NAME="${GOOGLE_VERTEX_SERVICE_ACCOUNT_NAME:-memexai-vertex-smoke}"
KEY_PATH="${GOOGLE_APPLICATION_CREDENTIALS_HOST:-$REPO_ROOT/.secrets/google-vertex-sa.json}"
ENV_PATH="${GOOGLE_VERTEX_ENV_PATH:-$REPO_ROOT/.env.vertex.local}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required. Install it and run 'gcloud auth login' first." >&2
  exit 1
fi

PROJECT="${GOOGLE_VERTEX_PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
  echo "No Google Cloud project is configured. Run 'gcloud config set project <project-id>' or set GOOGLE_VERTEX_PROJECT." >&2
  exit 1
fi

ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT}.iam.gserviceaccount.com"

echo "Using project: $PROJECT"
echo "Using location: $LOCATION"
echo "Using model: $MODEL"

gcloud services enable aiplatform.googleapis.com --project "$PROJECT" >/dev/null

if ! gcloud iam service-accounts describe "$ACCOUNT_EMAIL" --project "$PROJECT" >/dev/null 2>&1; then
  echo "Creating service account: $ACCOUNT_EMAIL"
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
    --project "$PROJECT" \
    --display-name "MemexAI Vertex smoke" >/dev/null
else
  echo "Reusing service account: $ACCOUNT_EMAIL"
fi

for attempt in {1..12}; do
  if gcloud iam service-accounts describe "$ACCOUNT_EMAIL" --project "$PROJECT" >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == "12" ]]; then
    echo "Service account was not visible to IAM after waiting: $ACCOUNT_EMAIL" >&2
    exit 1
  fi
  sleep 5
done

echo "Granting roles/aiplatform.user to $ACCOUNT_EMAIL"
for attempt in {1..6}; do
  if gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:${ACCOUNT_EMAIL}" \
    --role "roles/aiplatform.user" \
    --condition=None >/dev/null; then
    break
  fi
  if [[ "$attempt" == "6" ]]; then
    echo "Failed to grant roles/aiplatform.user to $ACCOUNT_EMAIL" >&2
    exit 1
  fi
  sleep 5
done

mkdir -p "$(dirname "$KEY_PATH")"
if [[ -f "$KEY_PATH" ]]; then
  echo "Reusing existing key: $KEY_PATH"
else
  echo "Creating service account key: $KEY_PATH"
  gcloud iam service-accounts keys create "$KEY_PATH" \
    --iam-account "$ACCOUNT_EMAIL" \
    --project "$PROJECT" >/dev/null
fi

cat > "$ENV_PATH" <<EOF
MEMEX_LLM_PROVIDER=vertex
GOOGLE_VERTEX_PROJECT=$PROJECT
GOOGLE_VERTEX_LOCATION=$LOCATION
GOOGLE_VERTEX_MODEL=$MODEL
GOOGLE_APPLICATION_CREDENTIALS_HOST=$KEY_PATH
GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google-vertex-sa.json
EOF

echo "Wrote Vertex Docker env -> $ENV_PATH"
echo
echo "Run:"
echo "  set -a"
echo "  source $ENV_PATH"
echo "  set +a"
echo "  docker compose up -d --build"
