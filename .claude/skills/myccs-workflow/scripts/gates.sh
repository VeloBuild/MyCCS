#!/usr/bin/env bash
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]]; then
  echo "ERROR: Direct work on '${BRANCH}' is blocked. Checkout a SCRUM-* branch." >&2
  exit 1
fi

if [[ ! "$BRANCH" =~ ^(feat|fix|hotfix|chore|refactor)/SCRUM-[0-9]+-[a-z0-9-]+$ ]]; then
  echo "WARNING: Branch '${BRANCH}' does not match <type>/SCRUM-<N>-<kebab-case>."
fi

echo "==> TypeScript check"
npx tsc --noEmit

echo "==> Jest unit tests"
npm test -- --ci

echo "==> Local gates passed."
