#!/usr/bin/env bash
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]]; then
  echo "ERROR: Direct push to protected branch '${BRANCH}' is forbidden." >&2
  exit 1
fi

if [[ ! "$BRANCH" =~ SCRUM-[0-9]+ ]]; then
  echo "ERROR: Branch '${BRANCH}' must include a SCRUM-<number> Jira key." >&2
  exit 1
fi

git push -u origin "$BRANCH"
