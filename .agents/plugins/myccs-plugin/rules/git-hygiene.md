---
trigger: always_on
description: Enforce branch naming, Conventional Commits format, and Jira ID presence on every task that involves Git or commits.
---

## Git Hygiene

### Branch naming

All branches must follow the Jira integration pattern: `SCRUM-XXXX-{Task-Name}` or `<type>/SCRUM-XXXX-kebab-description`.

| Type | Use |
|------|-----|
| `feat/` | New features or user stories |
| `fix/` | Bug fixes targeting develop |
| `hotfix/` | Emergency production fixes |
| `chore/` | Config or dependency bumps |
| `refactor/` | Structural code changes |

`main` and `develop` are protected — no direct commits. Always use a PR.

### Commit message format

```
SCRUM-XXXX {Task Name}
```
*(Also valid: `<type>(<scope>): [SCRUM-XXXX] <short description>`)*

- The commit must start with or contain the Jira key.
- Description: imperative mood.

**Valid:** `SCRUM-12 Implement local sqlite caching for offline scans`
**Valid:** `feat(qr): [SCRUM-12] implement local sqlite caching for offline scans`  
**Invalid:** `feat: add qr stuff`

### Atomic Commit Rule — Supabase

When a feature requires a database change: commit the React Native code **and** the Supabase migration SQL file in the **same commit**. Never split them across separate commits.

### Squash and Merge

All PRs targeting `develop` must use **Squash and Merge** — remind the user to select this before merging.
