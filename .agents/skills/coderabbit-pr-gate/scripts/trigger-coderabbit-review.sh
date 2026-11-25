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
    --jq "([.check_runs[] | select(.name == \"CodeRabbit\" and (if ((.details_url // \"\") | test(\"/pull/[0-9]+([/?#]|$)\")) then ((.details_url // \"\") | test(\"/pull/${PR_NUMBER}([/?#]|$)\")) else ((.pull_requests // []) | any(.number == ${PR_NUMBER})) end))] | sort_by(.id) | last) // empty | \"\(.id // \"\")|\(.status // \"none\")|\(.conclusion // \"none\")|\(.started_at // \"\")|\(.completed_at // \"\")\""
}

iso_to_epoch() {
  local ts="$1"
  date -u -d "$ts" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null || echo 0
}

CR_STATE=$(get_cr_status || true)
IFS='|' read -r CR_ID CR_STATUS CR_CONCLUSION CR_STARTED_AT CR_COMPLETED_AT <<< "${CR_STATE:-none|none|none||}"
[[ "$CR_ID" == "none" ]] && CR_ID=""
INITIAL_CR_ID="$CR_ID"
INITIAL_CR_COMPLETED_AT="$CR_COMPLETED_AT"

echo "PR #${PR_NUMBER} (${REPO}) | HEAD ${HEAD_SHA:0:7} | CodeRabbit: ${CR_STATUS:-none}/${CR_CONCLUSION:-none}"

if [[ "$CR_STATUS" == "completed" && "$CR_CONCLUSION" == "success" ]]; then
  echo "CodeRabbit review already completed for PR #${PR_NUMBER} at HEAD ${HEAD_SHA:0:7}."
elif [[ "$CR_STATUS" == "in_progress" || "$CR_STATUS" == "queued" ]]; then
  echo "CodeRabbit review is already ${CR_STATUS} for PR #${PR_NUMBER} at HEAD ${HEAD_SHA:0:7}."
else
  REQUEST_MARKER="<!-- coderabbit-pr-gate:head=${HEAD_SHA} -->"
  LAST_REQUEST_AT=$(gh api --paginate "repos/${REPO}/issues/${PR_NUMBER}/comments" \
    --jq ".[] | select((.body // \"\") | contains(\"${REQUEST_MARKER}\")) | .created_at" | tail -n 1)

  SHOULD_POST=true
  CHECK_AFTER_REQUEST=false
  if [[ -n "$LAST_REQUEST_AT" ]]; then
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
    REVIEW_CMD="@coderabbitai review"
    if [[ "$CHECK_AFTER_REQUEST" == true || ( "$CR_STATUS" == "completed" && "$CR_CONCLUSION" != "skipped" && "$CR_CONCLUSION" != "none" ) ]]; then
      REVIEW_CMD="@coderabbitai full review"
    fi
    if [[ -n "$LAST_REQUEST_AT" ]]; then
      echo "Previous review request for HEAD ${HEAD_SHA:0:7} (${LAST_REQUEST_AT}) did not produce a started or successful review; posting '${REVIEW_CMD}' on PR #${PR_NUMBER}..."
    else
      echo "Posting '${REVIEW_CMD}' on PR #${PR_NUMBER} for HEAD ${HEAD_SHA:0:7}..."
    fi
    gh api "repos/${REPO}/issues/${PR_NUMBER}/comments" --method POST \
      -f body="${REVIEW_CMD}"$'\n'"${REQUEST_MARKER}" --silent
  fi
fi

if [[ "$WAIT" == true ]]; then
  echo "Waiting for CodeRabbit review to complete (timeout: ${TIMEOUT_SEC}s)..."
  ELAPSED=0
  SEEN_ACTIVE=false
  if [[ "$CR_STATUS" == "in_progress" || "$CR_STATUS" == "queued" ]]; then
    SEEN_ACTIVE=true
  fi
  REVIEW_DONE=false
  EXIT_CODE=0

  while true; do
    CURRENT_HEAD_SHA=$(get_pr_head)
    if [[ "$CURRENT_HEAD_SHA" != "$HEAD_SHA" ]]; then
      echo "ERROR: PR #${PR_NUMBER} head changed during wait (${HEAD_SHA:0:7} -> ${CURRENT_HEAD_SHA:0:7}); re-run for the new HEAD." >&2
      exit 1
    fi

    CR_STATE=$(get_cr_status || true)
    IFS='|' read -r CR_ID CR_STATUS CR_CONCLUSION CR_STARTED_AT CR_COMPLETED_AT <<< "${CR_STATE:-none|none|none||}"
    [[ "$CR_ID" == "none" ]] && CR_ID=""

    if [[ "$CR_STATUS" == "in_progress" || "$CR_STATUS" == "queued" ]]; then
      SEEN_ACTIVE=true
    fi

    NEW_RUN_COMPLETED=false
    if [[ "$CR_STATUS" == "completed" && ( ( -n "$CR_ID" && "$CR_ID" != "$INITIAL_CR_ID" ) || ( -n "$CR_COMPLETED_AT" && "$CR_COMPLETED_AT" != "$INITIAL_CR_COMPLETED_AT" ) ) ]]; then
      NEW_RUN_COMPLETED=true
    fi

    if [[ "$CR_STATUS" == "completed" && "$CR_CONCLUSION" == "success" ]]; then
      CURRENT_HEAD_SHA=$(get_pr_head)
      if [[ "$CURRENT_HEAD_SHA" != "$HEAD_SHA" ]]; then
        echo "ERROR: PR #${PR_NUMBER} head changed before completion (${HEAD_SHA:0:7} -> ${CURRENT_HEAD_SHA:0:7}); re-run for the new HEAD." >&2
        exit 1
      fi
      echo "CodeRabbit review completed (success) for PR #${PR_NUMBER} at HEAD ${HEAD_SHA:0:7}."
      REVIEW_DONE=true
      break
    fi

    if [[ ( "$SEEN_ACTIVE" == true || "$NEW_RUN_COMPLETED" == true ) && "$CR_STATUS" == "completed" ]]; then
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
