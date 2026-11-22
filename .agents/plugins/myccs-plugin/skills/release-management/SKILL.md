---
name: release-management
description: Skill to aggregate squash-merged PRs, generate release notes, and fetch EAS links.
---

# Release Management Skill

Instructions for handling the release process and summarizing changes.

## 1. Aggregate PR Data
- Use the GitHub API or `gh pr list --state merged --base main` to fetch recently merged PRs.
- Filter for squash-merged PRs. Exclude drafts.
- Extract `SCRUM-XXXX` Jira keys from titles and commit bodies.

## 2. Generate Release Notes
- Categorize PRs using Conventional Commits prefixes:
  - `feat` -> Features
  - `fix` -> Bug Fixes
  - `BREAKING CHANGE` -> Breaking Changes
- Format as Markdown. Hyperlink all Jira tickets (e.g. `[SCRUM-101](https://your-domain.atlassian.net/browse/SCRUM-101)`).
- Include a Contributors section listing unique PR authors.
- Determine version bump: MAJOR for breaking changes, MINOR for features, PATCH for fixes.

## 3. Fetch Expo EAS Links
- Check `app.json` for the Expo project ID (`expo.extra.eas.projectId`).
- Use the Expo CLI (`eas build:list --limit 1 --json`) or EAS API to fetch the latest successful build link.
- Warn the user if the build's download link has expired.
