---
trigger: model_decision
description: Use this rule when the agent is preparing to open or review a pull request, to verify all CI/CD gate requirements are met first.
---

## PR Readiness — CI/CD Gate

Before creating a PR, verify Gates 1–2 and 4–6 (and surface any known Gate 3 security issues). State any failure and stop. After creating or updating the PR, complete the post-creation CodeRabbit review gate before marking the PR ready or merging.

### Gate 1 — Jira Linkage
PR title must contain `SCRUM-\d+`. If missing, ask for the Jira ticket number before continuing.

### Gate 2 — Target Branch
- `feat/`, `fix/`, `chore/`, `refactor/` → must target `develop`
- `develop` → may only target `main` during a planned release cutover
- `hotfix/` → may target `main` directly

### Gate 3 — Security scan & CodeRabbit review
The following run automatically — surface any known issues before CI catches them:
- **CodeQL** (SAST), **Snyk** (SCA), **CodeRabbit AI** (architectural review)
- **Post-creation gate (before ready/merge):** Because OSS repos with `< 10` stars skip automatic CodeRabbit reviews, run `bash .agents/skills/coderabbit-pr-gate/scripts/trigger-coderabbit-review.sh [PR_NUMBER] --wait` after opening/updating a PR and inspect findings before Squash & Merge.

### Gate 4 — Test coverage
Changes to `.ts`/`.tsx` files outside `tests/` must have corresponding Jest unit tests. Thresholds: statements ≥ 80%, branches ≥ 75%, functions ≥ 80%, lines ≥ 80%.

### Gate 5 — Migration pairing
If `supabase/migrations/` is touched, confirm the migration and its paired React Native code are in the same commit.

### Gate 6 — Merge strategy
Remind the user: select **Squash and Merge** in the GitHub UI before merging into `develop`.
