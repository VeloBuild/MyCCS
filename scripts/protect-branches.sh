#!/usr/bin/env bash

# =============================================================================
# Branch Protection Configuration Script
# =============================================================================
# Configures GitHub branch protection rules for 'main' and 'develop' branches.
# Enforces: PR required, squash-merge only, status checks, no direct pushes.
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated
#   - Repository must exist on GitHub
#
# Usage:
#   bash scripts/protect-branches.sh
# =============================================================================

set -euo pipefail

OWNER="VeloBuild"
REPO="MyCCS"

echo "🔧 Configuring repository settings for $OWNER/$REPO..."
echo ""

# ---------------------------------------------------------------------------
# Step 1: Enforce Squash-and-Merge only (repo-level setting)
# ---------------------------------------------------------------------------
echo "📦 Setting merge strategy to squash-only..."
gh api "repos/$OWNER/$REPO" \
  --method PATCH \
  --field allow_squash_merge=true \
  --field allow_merge_commit=false \
  --field allow_rebase_merge=false \
  --field delete_branch_on_merge=true \
  --silent

echo "   ✅ Squash-and-merge enforced"
echo ""

# ---------------------------------------------------------------------------
# Step 2: Configure branch protection for both permanent branches
# ---------------------------------------------------------------------------
BRANCHES=("main" "develop")
STATUS_CHECKS='["CodeRabbit AI","Jest","Newman","CodeQL","Snyk"]'

for BRANCH in "${BRANCHES[@]}"; do
  echo "🔒 Protecting branch: $BRANCH"

  gh api "repos/$OWNER/$REPO/branches/$BRANCH/protection" \
    --method PUT \
    --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Phase 2 · CodeRabbit AI Review", "Phase 2 · CodeQL SAST", "Phase 2 · Snyk SCA", "Phase 3 · Jest Unit Tests", "Phase 3 · Newman API Tests"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
EOF

  echo "   ✅ Branch protection applied to '$BRANCH'"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All branch protection rules configured!"
echo ""
echo "Summary:"
echo "  • Squash-and-merge only (merge commits & rebase disabled)"
echo "  • Direct pushes blocked on main & develop"
echo "  • Pull requests required with 1 approving review"
echo "  • Status checks required: CodeRabbit, CodeQL, Snyk, Jest, Newman"
echo "  • Stale review dismissal enabled"
echo "  • Admin enforcement enabled"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
