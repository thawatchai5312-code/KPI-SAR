#!/usr/bin/env bash
# Push local code to Apps Script, then redeploy every existing web-app deployment
# in place, so each /exec URL stays the same and serves the new code on reload.
set -euo pipefail
cd "$(dirname "$0")/.."

CLASP="npx --yes @google/clasp@3"
DESC="${1:-$(git log -1 --format='%h %s' 2>/dev/null || date -u +%FT%TZ)}"
DESC="${DESC:0:100}"

# Deployments to update: DEPLOYMENT_ID env var (space-separated) if set,
# otherwise all non-HEAD deployments of the project.
if [[ -n "${DEPLOYMENT_ID:-}" ]]; then
  IDS="$DEPLOYMENT_ID"
else
  IDS="$($CLASP list-deployments | grep -E '^- ' | grep -v '@HEAD' | awk '{print $2}')"
fi
if [[ -z "$IDS" ]]; then
  echo "No web-app deployment found. Create one in the Apps Script editor first." >&2
  exit 1
fi

echo "==> clasp push"
$CLASP push -f

for id in $IDS; do
  echo "==> redeploy $id"
  $CLASP deploy -i "$id" -d "$DESC"
  echo "    https://script.google.com/macros/s/$id/exec"
done
