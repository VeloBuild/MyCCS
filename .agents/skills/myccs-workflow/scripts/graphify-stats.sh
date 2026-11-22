#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "graphify-out/GRAPH_REPORT.md" ]]; then
  echo "ERROR: graphify-out/GRAPH_REPORT.md not found." >&2
  exit 1
fi

head -n 45 graphify-out/GRAPH_REPORT.md
