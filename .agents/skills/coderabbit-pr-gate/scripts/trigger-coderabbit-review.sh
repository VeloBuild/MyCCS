#!/usr/bin/env bash
set -euo pipefail

# Trigger @coderabbitai review on an open PR if CodeRabbit skipped or has not reviewed HEAD.
# Usage: bash .agents/skills/coderabbit-pr-gate/scripts/trigger-coderabbit-review.sh [PR_NUMBER] [--wait]

PR_NUMBER=""
WAIT=false
TIMEOUT_SEC="${CODERABBIT_WAIT_TIMEOUT:-300}"
POLL_INTERVAL=10
RETRY_GRACE_SEC="${CODERABBIT_RETRY_GRACE:-60}"

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

get_pr_head() {
  gh api "repos/${REPO}/pulls/${PR_NUMBER}" --jq '.head.sha'
}

get_cr_status() {
  gh api "repos/${REPO}/commits/${HEAD_SHA}/check-runs" \
    --jq '([.check_runs[] | select(.name == "CodeRabbit")] | sort_by(.id) | last) // empty | "\(.status // "none")|\(.conclusion // "none")|\(.started_at // "")|\(.completed_at // "")"'
}

iso_to_epoch() {
  local ts="$1"
  date -u -d "$ts" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null || echo 0
}

CR_STATE=$(get_cr_status || true)
IFS='|' read -r CR_STATUS CR_CONCLUSION CR_STARTED_AT CR_COMPLETED_AT <<< "${CR_STATE:-none|none||}"

echo "PR #${PR_NUMBER} (${REPO}) | HEAD ${HEAD_SHA:0:7} | CodeRabbit: ${CR_STATUS:-none}/${CR_CONCLUSION:-none}"

if [[ "$CR_STATUS" == "completed" && "$CR_CONCLUSION" == "success" ]]; then
  echo "CodeRabbit review already completed for HEAD ${HEAD_SHA:0:7}."
elif [[ "$CR_STATUS" == "in_progress" || "$CR_STATUS" == "queued" ]]; then
  echo "CodeRabbit review is already ${CR_STATUS} for HEAD ${HEAD_SHA:0:7}."
else
  REQUEST_MARKER="<!-- coderabbit-pr-gate:head=${HEAD_SHA} -->"
  LAST_REQUEST_AT=$(gh api --paginate "repos/${REPO}/issues/${PR_NUMBER}/comments" \
    --jq ".[] | select((.body // \"\") | contains(\"${REQUEST_MARKER}\")) | .created_at" | tail -n 1)

  SHOULD_POST=true
  if [[ -n "$LAST_REQUEST_AT" ]]; then
    CHECK_AFTER_REQUEST=false
    if [[ -n "$CR_COMPLETED_AT" && ! "$CR_COMPLETED_AT" < "$LAST_REQUEST_AT" ]]; then
      CHECK_AFTER_REQUEST=true
    elif [[ -n "$CR_STARTED_AT" && ! "$CR_STARTED_AT" < "$LAST_REQUEST_AT" ]]; then
      CHECK_AFTER_REQUEST=true
    fi

    if [[ "$CHECK_AFTER_REQUEST" == false ]]; then
      NOW_EPOCH=$(date -u +%s)
      LAST_REQ_EPOCH=$(iso_to_epoch "$LAST_REQUEST_AT")
      REQUEST_AGE=$((NOW_EPOCH - LAST_REQ_EPOCH))
      if (( REQUEST_AGE < RETRY_GRACE_SEC )); then
        SHOULD_POST=false
        echo "@coderabbitai review was recently requested for HEAD ${HEAD_SHA:0:7} (${LAST_REQUEST_AT}, ${REQUEST_AGE}s ago); skipping duplicate comment."
      fi
    fi
  fi

  if [[ "$SHOULD_POST" == true ]]; then
    if [[ -n "$LAST_REQUEST_AT" ]]; then
      echo "Previous review request for HEAD ${HEAD_SHA:0:7} (${LAST_REQUEST_AT}) did not produce a started or successful review; posting new '@coderabbitai review' on PR #${PR_NUMBER}..."
    else
      echo "Posting '@coderabbitai review' on PR #${PR_NUMBER} for HEAD ${HEAD_SHA:0:7}..."
    fi
    gh api "repos/${REPO}/issues/${PR_NUMBER}/comments" --method POST \
      -f body="@coderabbitai review"$'\n'"${REQUEST_MARKER}" --silent
  fi
fi

if [[ "$WAIT" == true ]]; then
  echo "Waiting for CodeRabbit review to complete (timeout: ${TIMEOUT_SEC}s)..."
  ELAPSED=0
  SEEN_ACTIVE=false
  REVIEW_DONE=false
  EXIT_CODE=0

  while true; do
    CURRENT_HEAD_SHA=$(get_pr_head)
    if [[ "$CURRENT_HEAD_SHA" != "$HEAD_SHA" ]]; then
      echo "ERROR: PR #${PR_NUMBER} head changed during wait (${HEAD_SHA:0:7} -> ${CURRENT_HEAD_SHA:0:7}); re-run for the new HEAD." >&2
      exit 1
    fi

    CR_STATE=$(get_cr_status || true)
    IFS='|' read -r CR_STATUS CR_CONCLUSION CR_STARTED_AT CR_COMPLETED_AT <<< "${CR_STATE:-none|none||}"

    if [[ "$CR_STATUS" == "in_progress" || "$CR_STATUS" == "queued" ]]; then
      SEEN_ACTIVE=true
    fi

    if [[ "$CR_STATUS" == "completed" && "$CR_CONCLUSION" == "success" ]]; then
      CURRENT_HEAD_SHA=$(get_pr_head)
      if [[ "$CURRENT_HEAD_SHA" != "$HEAD_SHA" ]]; then
        echo "ERROR: PR #${PR_NUMBER} head changed before completion (${HEAD_SHA:0:7} -> ${CURRENT_HEAD_SHA:0:7}); re-run for the new HEAD." >&2
        exit 1
      fi
      echo "CodeRabbit review completed (success)."
      REVIEW_DONE=true
      break
    fi

    if [[ "$SEEN_ACTIVE" == true && "$CR_STATUS" == "completed" ]]; then
      echo "ERROR: CodeRabbit review finished without succeeding (conclusion: ${CR_CONCLUSION:-none})." >&2
      REVIEW_DONE=true
      EXIT_CODE=1
      break
    fi

    if (( ELAPSED >= TIMEOUT_SEC )); then
      break
    fi

    SLEEP_SEC=$((TIMEOUT_SEC - ELAPSED))
    if (( SLEEP_SEC > POLL_INTERVAL )); then
      SLEEP_SEC=$POLL_INTERVAL
    fi
    sleep "$SLEEP_SEC"
    ELAPSED=$((ELAPSED + SLEEP_SEC))
  done

  if [[ "$REVIEW_DONE" != true ]]; then
    echo "WARNING: Timed out after ${TIMEOUT_SEC}s waiting for CodeRabbit (last state: ${CR_STATUS:-none}/${CR_CONCLUSION:-none})." >&2
    exit 2
  fi

  echo ""
  echo "=== CodeRabbit Inline Review Comments ==="
  COMMENTS=$(gh api --paginate "repos/${REPO}/pulls/${PR_NUMBER}/comments" \
    --jq '.[] | select(.user.login == "coderabbitai[bot]") | "- \(.path):\(.line // .original_line)\n\(.body)\n"')
  if [[ -n "$COMMENTS" ]]; then
    printf '%s\n' "$COMMENTS"
  else
    echo "(none)"
  fi

  exit "$EXIT_CODE"
fi
