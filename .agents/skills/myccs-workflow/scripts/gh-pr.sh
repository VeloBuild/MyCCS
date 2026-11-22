#!/usr/bin/env bash
set -euo pipefail

CMD="${1:-checks}"
shift || true

case "$CMD" in
  create)
    BASE="${1:-develop}"
    TITLE="${2:-}"
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [[ ! "$BRANCH" =~ SCRUM-[0-9]+ ]]; then
      echo "ERROR: Branch '${BRANCH}' must include a SCRUM-<number> key." >&2
      exit 1
    fi
    if [[ -z "$TITLE" ]]; then
      TITLE=$(git log -1 --pretty=%s)
    fi
    if [[ ! "$TITLE" =~ SCRUM-[0-9]+ ]]; then
      echo "ERROR: PR title '${TITLE}' must include a SCRUM-<number> key." >&2
      exit 1
    fi
    gh pr create --base "$BASE" --title "$TITLE" --fill
    ;;
  checks)
    gh pr checks "$@"
    ;;
  merge)
    echo "Merging with Squash & Merge (required for develop)..."
    gh pr merge --squash --delete-branch "$@"
    ;;
  *)
    echo "Usage: $0 [create [base] [title]|checks|merge]" >&2
    exit 1
    ;;
esac
