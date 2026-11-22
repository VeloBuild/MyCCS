#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-develop}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]]; then
  echo "ERROR: Cannot ship directly from protected branch '${BRANCH}'." >&2
  exit 1
fi

if [[ ! "$BRANCH" =~ SCRUM-[0-9]+ ]]; then
  echo "ERROR: Branch '${BRANCH}' must include a SCRUM-<number> Jira key." >&2
  exit 1
fi

echo "==> 1/4 Running local gates"
npx tsc --noEmit
npm test -- --ci

echo "==> 2/4 Pushing branch '${BRANCH}'"
git push -u origin "$BRANCH"

echo "==> 3/4 Opening or checking PR targeting '${BASE}'"
if ! gh pr view >/dev/null 2>&1; then
  TITLE=$(git log -1 --pretty=%s)
  gh pr create --base "$BASE" --title "$TITLE" --fill
fi

echo "==> 4/4 Watching CI checks"
gh pr checks --watch
