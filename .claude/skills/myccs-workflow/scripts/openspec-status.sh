#!/usr/bin/env bash
set -euo pipefail

if ! command -v openspec >/dev/null 2>&1; then
  echo "ERROR: 'openspec' CLI not found on PATH." >&2
  exit 1
fi

CHANGE_NAME="${1:-}"
if [[ -z "$CHANGE_NAME" ]]; then
  openspec list
else
  openspec status --change "$CHANGE_NAME"
fi
