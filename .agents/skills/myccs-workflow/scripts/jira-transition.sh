#!/usr/bin/env bash
set -euo pipefail

TICKET_ID="${1:-}"
TARGET_STATUS="${2:-}"

if [[ -z "$TICKET_ID" || -z "$TARGET_STATUS" ]] || [[ ! "$TICKET_ID" =~ ^SCRUM-[0-9]+$ ]]; then
  echo "Usage: $0 SCRUM-<number> \"In Progress|In Review|Done\"" >&2
  exit 1
fi

: "${JIRA_BASE_URL:?Set JIRA_BASE_URL in environment}"
: "${JIRA_EMAIL:?Set JIRA_EMAIL in environment}"
: "${JIRA_API_TOKEN:?Set JIRA_API_TOKEN in environment}"

CURRENT=$(curl -fsS -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  -H "Accept: application/json" \
  "${JIRA_BASE_URL}/rest/api/3/issue/${TICKET_ID}?fields=status" | \
  node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.fields?.status?.name || '');")

if [[ "$CURRENT" == "$TARGET_STATUS" ]]; then
  echo "${TICKET_ID} is already in '${TARGET_STATUS}' (no-op)."
  exit 0
fi

TRANSITION_ID=$(curl -fsS -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  -H "Accept: application/json" \
  "${JIRA_BASE_URL}/rest/api/3/issue/${TICKET_ID}/transitions" | \
  TARGET="$TARGET_STATUS" node -e "const d = JSON.parse(require('fs').readFileSync(0,'utf8')); const t = (d.transitions||[]).find(x => x.name.toLowerCase() === process.env.TARGET.toLowerCase()); console.log(t ? t.id : '');")

if [[ -z "$TRANSITION_ID" ]]; then
  echo "No valid transition to '${TARGET_STATUS}' found for ${TICKET_ID} (current: '${CURRENT}')." >&2
  exit 1
fi

curl -fsS -X POST -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"transition\":{\"id\":\"${TRANSITION_ID}\"}}" \
  "${JIRA_BASE_URL}/rest/api/3/issue/${TICKET_ID}/transitions"

echo "Transitioned ${TICKET_ID}: '${CURRENT}' -> '${TARGET_STATUS}'."
