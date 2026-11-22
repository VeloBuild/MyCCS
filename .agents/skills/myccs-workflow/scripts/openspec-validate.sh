#!/usr/bin/env bash
set -euo pipefail

CHANGE_NAME="${1:-}"
if [[ -z "$CHANGE_NAME" ]]; then
  echo "Usage: $0 <change-name>" >&2
  exit 1
fi

CHANGE_DIR="openspec/changes/${CHANGE_NAME}"
if [[ ! -d "$CHANGE_DIR" ]]; then
  echo "ERROR: Change directory '${CHANGE_DIR}' not found." >&2
  exit 1
fi

if ! grep -rqE "SCRUM-[0-9]+" "$CHANGE_DIR"; then
  echo "WARNING: No SCRUM-<number> Jira ticket reference found in ${CHANGE_DIR}."
fi

if command -v openspec >/dev/null 2>&1; then
  openspec validate "$CHANGE_NAME"
else
  echo "WARNING: 'openspec' CLI not installed; skipped schema validation."
fi
