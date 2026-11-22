# Scripts Directory Agent Instructions (`scripts/`)

## Purpose

Stores repository automation and governance scripts (`protect-branches.sh`, `branch-protection-body.json`).

## Conventions

- Keep `branch-protection-body.json` `required_status_checks.contexts` strictly synchronized with the exact job `name:` strings in `.github/workflows/ci.yml` (Phases 1–3).
- Scripts must be idempotent, POSIX/bash-safe, and never read or print secrets (`.env*`, tokens) directly.
- Document any new script flags or required GitHub permissions in comments at the top of the script.

## References

- [CI/CD Pipeline Specification](../docs/jira/CI_CD%20Pipeline%20Specification_%20Centralized%20Department%20Mobile%20App.md)
- [Repo Rules](../rules.md)
