#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]] || [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
  echo "Usage: $0 vX.Y.Z [previous-tag]" >&2
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Releases must be cut from 'main' (current: '${BRANCH}')." >&2
  exit 1
fi

PREV_TAG="${2:-$(git describe --tags --abbrev=0 2>/dev/null || true)}"
if [[ -n "$PREV_TAG" ]]; then
  NOTES=$(git log "${PREV_TAG}..HEAD" --pretty=format:"- %s (%h)")
else
  NOTES=$(git log --pretty=format:"- %s (%h)" -n 50)
fi

NOTES_BODY="## What's Changed

${NOTES}

### Deployment Targets
- Mobile: Expo EAS
- Web Admin: Cloudflare Pages (\`web-admin/\`)
- Backend: Supabase (PostgreSQL + Edge Functions)"

gh release create "$TAG" \
  --target main \
  --title "MyCCS ${TAG}" \
  --notes "$NOTES_BODY"
