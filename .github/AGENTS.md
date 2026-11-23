# GitHub Directory Agent Instructions (`.github/`)

## Purpose

Owns GitHub Actions CI/CD workflows (`workflows/ci.yml`), issue templates (`ISSUE_TEMPLATE/`), Dependabot (`dependabot.yml`), repository instructions (`copilot-instructions.md`, `instructions/`), and custom GitHub agents (`agents/`).

## Mandatory Rules

1. **PR CI vs. Post-Merge CD Separation:** Never trigger builds or production/staging deploys (`Phase 4`, `Phase 5`) on `pull_request` events. `pull_request` runs Phases 1–3 only; `push` to `develop`/`main` runs Phases 4–5.
2. **Required Status Checks Parity:** Any job name change in `workflows/ci.yml` must be mirrored in `scripts/branch-protection-body.json` and `docs/jira/CI_CD Pipeline Specification_ Centralized Department Mobile App.md`.
3. **Agent Sync:** Keep `.github/agents/*.agent.md` aligned with `.agents/plugins/myccs-plugin/agents/` and `AGENTS.md`.
4. **Dependabot Coverage:** Keep `dependabot.yml` covering both root mobile `package.json` and `web-admin/package.json` once `web-admin/` is scaffolded.

## References

- [CI/CD Pipeline Specification](../docs/jira/CI_CD%20Pipeline%20Specification_%20Centralized%20Department%20Mobile%20App.md)
- [Git Branching & Version Control Strategy](../docs/jira/Git%20Branching%20%26%20Version%20Control%20Strategy.md)
- [Repo Rules](../rules.md)
