#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "graphify-out/graph.json" ]]; then
  echo "ERROR: graphify-out/graph.json not found. Initialize with /graphify . first." >&2
  exit 1
fi

graphify update .
graphify export html
echo "Graphify AST update and HTML export complete."
