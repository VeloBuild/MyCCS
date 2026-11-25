---
trigger: model_decision
description: Enforce running @coderabbitai review on open PRs before Squash & Merge on VeloBuild/MyCCS.
---

## CodeRabbit PR Review Gate

Because `VeloBuild/MyCCS` is an OSS repository with fewer than 10 stars, CodeRabbit skips automatic PR reviews (`conclusion: skipped`).

Rules:
- Whenever you open a Pull Request or push new commits to an open PR, run:
  `bash .agents/skills/coderabbit-pr-gate/scripts/trigger-coderabbit-review.sh [PR_NUMBER] --wait`
- Follow the `coderabbit-pr-gate` skill (`.agents/skills/coderabbit-pr-gate/SKILL.md`) to inspect and address CodeRabbit findings before Squash & Merge.
- Never squash-merge an open PR while `CodeRabbit` is `in_progress`, `queued`, or `skipped` without triggering `@coderabbitai review` first (unless explicitly waived by the user).
