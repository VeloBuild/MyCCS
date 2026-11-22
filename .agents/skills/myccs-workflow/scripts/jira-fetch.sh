#!/usr/bin/env bash
set -euo pipefail

TICKET_ID="${1:-}"
if [[ -z "$TICKET_ID" ]] || [[ ! "$TICKET_ID" =~ ^SCRUM-[0-9]+$ ]]; then
  echo "Usage: $0 SCRUM-<number>" >&2
  exit 1
fi

: "${JIRA_BASE_URL:?Set JIRA_BASE_URL in environment}"
: "${JIRA_EMAIL:?Set JIRA_EMAIL in environment}"
: "${JIRA_API_TOKEN:?Set JIRA_API_TOKEN in environment}"

curl -fsS -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  -H "Accept: application/json" \
  "${JIRA_BASE_URL}/rest/api/3/issue/${TICKET_ID}?fields=summary,status,assignee,priority,description"
