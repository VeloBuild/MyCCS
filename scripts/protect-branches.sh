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

for BRANCH in "${BRANCHES[@]}"; do
  echo "🔒 Protecting branch: $BRANCH"

  gh api "repos/$OWNER/$REPO/branches/$BRANCH/protection" \
    --method PUT \
    --input scripts/branch-protection-body.json

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
echo "  • Status checks required: Jira, CodeRabbit, CodeQL, Snyk, Jest, Newman, Playwright"
echo "  • Stale review dismissal enabled"
echo "  • Admin enforcement enabled"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
