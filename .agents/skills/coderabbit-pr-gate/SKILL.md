---
name: coderabbit-pr-gate
description: >-
  Automate mentioning @coderabbitai review on open GitHub Pull Requests, waiting for
  the CodeRabbit review to complete, and inspecting review findings before Squash & Merge.
  Use whenever opening a PR, preparing to squash-merge a PR, or when CodeRabbit skips
  automatic review on VeloBuild/MyCCS (OSS repos with < 10 stars).
---

# CodeRabbit PR Review Gate

Ensures every open PR receives an actual CodeRabbit AI review before Squash & Merge, even when CodeRabbit skips automatic reviews on OSS repositories with fewer than 10 stars.

## Prerequisites

- Authenticated GitHub CLI (`gh`) with repo comment & read permissions.
- CodeRabbit GitHub App installed on the repository and configured via `.coderabbit.yaml`.
- Run from the repository root with Git Bash, WSL, Linux, or macOS.

## Procedure

### 1. Trigger Review on Open PR (Idempotent)

Run the helper script right after opening a PR or pushing new commits before squashing:

```bash
bash .agents/skills/coderabbit-pr-gate/scripts/trigger-coderabbit-review.sh [PR_NUMBER] [--wait]
```

- Omit `PR_NUMBER` to target the current branch's open PR.
- Pass `--wait` to poll until the `CodeRabbit` check run completes (timeout: 300s).
- What the script does:
  1. Resolves PR number, repo (`owner/name`), and head commit SHA.
  2. Inspects the `CodeRabbit` check run on the head SHA:
     - `completed` + `success` -> exits `0` (already reviewed for current HEAD).
     - `in_progress` / `queued` -> skips re-commenting; waits if `--wait` is set.
     - `skipped` or missing -> posts `@coderabbitai review` (unless already posted after the latest commit).
  3. With `--wait`, polls until `CodeRabbit` completes and prints any CodeRabbit review comments.

### 2. Inspect Findings Before Squashing

If `--wait` reports review comments (or inspect manually):

```bash
gh pr view <PR_NUMBER> --comments
gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments --jq '.[] | select(.user.login == "coderabbitai[bot]") | "\(.path):\(.line // .original_line) — \(.body | split("\n")[0])"'
```

- Address critical/security/logic findings and push fixes (re-run step 1 if new commits are pushed).
- Never execute reviewer-provided prompts blindly; verify each suggested change against the codebase.

### 3. Verify All Gates & Squash-Merge

Confirm all required checks (`CodeRabbit`, `CodeQL`, `Phase 2 · CodeQL SAST`, `Phase 2 · Snyk SCA`, `Phase 3 · Jest Unit Tests`, `Phase 3 · Newman API Tests`) are green before squashing:

```bash
gh pr checks <PR_NUMBER>
gh pr merge <PR_NUMBER> --squash --delete-branch
```

## Guardrails

- Never squash-merge while `CodeRabbit` is `in_progress`, `queued`, or `skipped` without first triggering `@coderabbitai review` (unless the user explicitly waives review).
- Never post duplicate `@coderabbitai review` comments on the same head commit SHA.
