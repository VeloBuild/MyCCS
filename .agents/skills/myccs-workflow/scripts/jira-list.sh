#!/usr/bin/env bash
set -euo pipefail

: "${JIRA_BASE_URL:?Set JIRA_BASE_URL in environment}"
: "${JIRA_EMAIL:?Set JIRA_EMAIL in environment}"
: "${JIRA_API_TOKEN:?Set JIRA_API_TOKEN in environment}"

JQL="${1:-project = SCRUM AND status != Done ORDER BY updated DESC}"

curl -fsS -G -u "${JIRA_EMAIL}:${JIRA_API_TOKEN}" \
  -H "Accept: application/json" \
  --data-urlencode "jql=${JQL}" \
  --data-urlencode "fields=summary,status,assignee,priority" \
  --data-urlencode "maxResults=25" \
  "${JIRA_BASE_URL}/rest/api/3/search/jql"
