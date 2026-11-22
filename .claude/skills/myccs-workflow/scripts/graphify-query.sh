#!/usr/bin/env bash
set -euo pipefail

QUESTION="${1:-}"
if [[ -z "$QUESTION" ]]; then
  echo "Usage: $0 \"<question>\"" >&2
  exit 1
fi

if [[ ! -f "graphify-out/graph.json" ]]; then
  echo "ERROR: graphify-out/graph.json not found. Run /graphify . first." >&2
  exit 1
fi

graphify query "$QUESTION"
