#!/usr/bin/env bash
set -euo pipefail

CMD="${1:-list}"
shift || true

case "$CMD" in
  list)
    gh issue list --state open --limit 30 "$@"
    ;;
  create)
    TITLE="${1:-}"
    BODY="${2:-}"
    if [[ -z "$TITLE" ]]; then
      echo "Usage: $0 create \"[SCRUM-<N>] Issue title\" \"Optional body\"" >&2
      exit 1
    fi
    gh issue create --title "$TITLE" --body "${BODY:-Linked to MyCCS backlog.}"
    ;;
  *)
    echo "Usage: $0 [list|create] ..." >&2
    exit 1
    ;;
esac
