#!/usr/bin/env bash
# Syncs Grafana dashboard JSON from the docker-compose source of truth
# (infra/grafana/dashboards/) into the Helm chart's copy
# (infra/helm/flagforge/files/dashboards/), so the two never drift.
#
# Usage:
#   scripts/sync-grafana-dashboards.sh          # copy src -> dest
#   scripts/sync-grafana-dashboards.sh --check  # copy, then fail if that
#                                                # changed anything (CI drift check)
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="infra/grafana/dashboards"
DEST="infra/helm/flagforge/files/dashboards"

mkdir -p "$DEST"
cp "$SRC"/*.json "$DEST"/

if [[ "${1:-}" == "--check" ]]; then
  if ! git diff --quiet -- "$DEST"; then
    echo "error: $DEST is out of sync with $SRC" >&2
    echo "run scripts/sync-grafana-dashboards.sh and commit the result" >&2
    git --no-pager diff -- "$DEST" >&2
    exit 1
  fi
fi
