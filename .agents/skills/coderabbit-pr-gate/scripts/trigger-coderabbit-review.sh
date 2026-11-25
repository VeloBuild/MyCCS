#!/usr/bin/env bash
set -euo pipefail

# Trigger @coderabbitai review on an open PR if CodeRabbit skipped or has not reviewed HEAD.
# Usage: bash .agents/skills/coderabbit-pr-gate/scripts/trigger-coderabbit-review.sh [PR_NUMBER] [--wait]

PR_NUMBER=""
WAIT=false
TIMEOUT_SEC="${CODERABBIT_WAIT_TIMEOUT:-300}"
POLL_INTERVAL=10

for arg in "$@"; do
  case "$arg" in
    --wait)
      WAIT=true
      ;;
    --help|-h)
      echo "Usage: $0 [PR_NUMBER] [--wait]"
      exit 0
      ;;
    *)
      if [[ -z "$PR_NUMBER" && "$arg" =~ ^[0-9]+$ ]]; then
        PR_NUMBER="$arg"
      else
        echo "ERROR: Unknown argument '$arg'. Usage: $0 [PR_NUMBER] [--wait]" >&2
        exit 1
      fi
      ;;
  esac
done

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

if [[ -z "$PR_NUMBER" ]]; then
  PR_NUMBER=$(gh pr view --json number -q .number)
fi

PR_META=$(gh api "repos/${REPO}/pulls/${PR_NUMBER}" --jq '"\(.state):\(.head.sha)"')
PR_STATE="${PR_META%%:*}"
HEAD_SHA="${PR_META##*:}"
if [[ "$PR_STATE" != "open" ]]; then
  echo "ERROR: PR #${PR_NUMBER} is ${PR_STATE}, not open." >&2
  exit 1
fi
HEAD_COMMIT_DATE=$(gh api "repos/${REPO}/commits/${HEAD_SHA}" --jq '.commit.committer.date')

get_cr_status() {
  gh api "repos/${REPO}/commits/${HEAD_SHA}/check-runs" \
    --jq '([.check_runs[] | select(.name == "CodeRabbit")] | sort_by(.id) | last) // empty | "\(.status // "none"):\(.conclusion // "none")"'
}

CR_STATE=$(get_cr_status || true)
CR_STATUS="${CR_STATE%%:*}"
CR_CONCLUSION="${CR_STATE##*:}"

echo "PR #${PR_NUMBER} (${REPO}) | HEAD ${HEAD_SHA:0:7} | CodeRabbit: ${CR_STATUS:-none}/${CR_CONCLUSION:-none}"

if [[ "$CR_STATUS" == "completed" && "$CR_CONCLUSION" == "success" ]]; then
  echo "CodeRabbit review already completed for HEAD ${HEAD_SHA:0:7}."
elif [[ "$CR_STATUS" == "in_progress" || "$CR_STATUS" == "queued" ]]; then
  echo "CodeRabbit review is already ${CR_STATUS} for HEAD ${HEAD_SHA:0:7}."
else
  # Avoid duplicate @coderabbitai review comments after the latest commit timestamp
  EXISTING_TRIGGER=$(gh api "repos/${REPO}/issues/${PR_NUMBER}/comments" \
    --jq "[.[] | select(.created_at >= \"${HEAD_COMMIT_DATE}\" and (.body | test(\"@coderabbitai\\\\s+review\"; \"i\")))] | length")

  if [[ "${EXISTING_TRIGGER:-0}" -gt 0 ]]; then
    echo "@coderabbitai review was already requested after HEAD commit (${HEAD_COMMIT_DATE}); skipping duplicate comment."
  else
    echo "Posting '@coderabbitai review' on PR #${PR_NUMBER}..."
    gh api "repos/${REPO}/issues/${PR_NUMBER}/comments" --method POST -f body="@coderabbitai review" --silent
  fi
fi

if [[ "$WAIT" == true ]]; then
  echo "Waiting for CodeRabbit review to complete (timeout: ${TIMEOUT_SEC}s)..."
  ELAPSED=0
  SEEN_ACTIVE=false
  while (( ELAPSED < TIMEOUT_SEC )); do
    CR_STATE=$(get_cr_status || true)
    CR_STATUS="${CR_STATE%%:*}"
    CR_CONCLUSION="${CR_STATE##*:}"

    if [[ "$CR_STATUS" == "in_progress" || "$CR_STATUS" == "queued" ]]; then
      SEEN_ACTIVE=true
    fi

    if [[ "$CR_STATUS" == "completed" && "$CR_CONCLUSION" == "success" ]]; then
      echo "CodeRabbit review completed (success)."
      break
    fi

    if [[ "$SEEN_ACTIVE" == true && "$CR_STATUS" == "completed" ]]; then
      echo "CodeRabbit review finished with conclusion: ${CR_CONCLUSION}."
      break
    fi

    sleep "$POLL_INTERVAL"
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
  done

  if (( ELAPSED >= TIMEOUT_SEC )); then
    echo "WARNING: Timed out after ${TIMEOUT_SEC}s waiting for CodeRabbit (last state: ${CR_STATUS:-none}/${CR_CONCLUSION:-none})." >&2
    exit 2
  fi

  echo ""
  echo "=== CodeRabbit Inline Review Comments ==="
  COMMENTS=$(gh api "repos/${REPO}/pulls/${PR_NUMBER}/comments" \
    --jq '.[] | select(.user.login == "coderabbitai[bot]") | "- \(.path):\(.line // .original_line) — \(.body | split("\n")[0])"')
  if [[ -n "$COMMENTS" ]]; then
    echo "$COMMENTS"
  else
    echo "(none)"
  fi
fi
