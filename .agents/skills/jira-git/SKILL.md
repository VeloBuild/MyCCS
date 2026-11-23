---
name: jira-git
description: Skill to validate conventional commits, extract Jira IDs, and trigger Jira status transitions.
---

# Jira-Git Skill

This skill provides instructions on how to perform Jira-aware Git operations in the MyCCS monorepo.

## 1. Validate Conventional Commits
When asked to validate commits for a branch or PR:
- Use `git log <base>..<head>` or GitHub PR API to fetch commit messages.
- Ensure every commit follows the format: `<type>(<scope>): [<JIRA-KEY>] <subject>`.
- Valid types: `feat`, `fix`, `chore`, `refactor`, `hotfix`.
- Reject any commits that lack a Jira key in the `SCRUM-\d+` format.

## 2. Extract Jira IDs
To find Jira keys:
- Parse branch names, PR titles, and commit messages using the regex `SCRUM-\d+`.
- Return a deduplicated list of identified Jira keys.

## 3. Trigger Status Transition
To transition a Jira status:
- Use the Atlassian Jira REST API (`curl` or similar if available) or the GitHub-Jira integration if configured.
- Idempotency check: First fetch the current issue status. Do not transition if it is already in the target status.
- Valid statuses include: `To Do`, `In Progress`, `In Review`, `Done`.
