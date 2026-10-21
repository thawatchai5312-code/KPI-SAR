#!/usr/bin/env bash
# Push local code to Apps Script, then redeploy the existing web-app deployment
# in place, so the /exec URL stays the same and serves the new code on reload.
set -euo pipefail
cd "$(dirname "$0")/.."

CLASP="npx --yes @google/clasp@3"
DESC="${1:-$(git log -1 --format='%h %s' 2>/dev/null || date -u +%FT%TZ)}"

# Deployment ID of the web app (/exec). Order: env var, .deployment-id file,
# else the most recently updated non-HEAD deployment.
DEPLOYMENT_ID="${DEPLOYMENT_ID:-}"
if [[ -z "$DEPLOYMENT_ID" && -f .deployment-id ]]; then
  DEPLOYMENT_ID="$(tr -d '[:space:]' < .deployment-id)"
fi
if [[ -z "$DEPLOYMENT_ID" ]]; then
  DEPLOYMENT_ID="$($CLASP list-deployments | grep -E '^- ' | grep -v '@HEAD' | head -1 | awk '{print $2}')"
fi
if [[ -z "$DEPLOYMENT_ID" ]]; then
  echo "No web-app deployment found. Create one in the Apps Script editor first." >&2
  exit 1
fi

echo "==> clasp push"
$CLASP push -f

echo "==> redeploy $DEPLOYMENT_ID"
$CLASP deploy -i "$DEPLOYMENT_ID" -d "${DESC:0:100}"

echo "Done. Reload https://script.google.com/macros/s/$DEPLOYMENT_ID/exec"
