---
name: myccs-workflow
description: Unified MyCCS engineering workflow covering Jira (SCRUM-* tickets & transitions), Graphify (knowledge graph query/update/stats), OpenSpec (spec-driven status/validation), and GitHub (issues, PRs, releases, and end-to-end shipping via gh CLI). Use when the user asks to resolve a Jira ticket, query/update Graphify, run OpenSpec checks, or manage GitHub issues, PRs, releases, or shipping.
---

# MyCCS Unified Workflow (`jira`, `graphify`, `openspec`, `github`)

Composable bash scripts in `scripts/` for Jira ticket resolution, Graphify knowledge-graph operations, OpenSpec spec-driven validation, and GitHub `issues`, `pr`, `release`, and `ship` workflows.

## Prerequisites

- `git`, `gh` (authenticated), `node`/`npm`, `curl`, `graphify`, `openspec`
- Jira scripts require exported env vars (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`) — never read `.env*` files directly.
- Run scripts from the repository root with Git Bash, WSL, Linux, or macOS (`bash .agents/skills/myccs-workflow/scripts/<script>.sh`).

## Scripts

### Local Gates & Safe Push
| Script | Purpose | Example |
|---|---|---|
| `scripts/gates.sh` | Verify `SCRUM-*` branch, run `tsc --noEmit` and `npm test -- --ci` | `bash .agents/skills/myccs-workflow/scripts/gates.sh` |
| `scripts/push.sh` | Block pushes to `main`/`develop` and push `SCRUM-*` branch | `bash .agents/skills/myccs-workflow/scripts/push.sh` |

### Jira (`SCRUM-*`)
| Script | Purpose | Example |
|---|---|---|
| `scripts/jira-list.sh` | List active `SCRUM` sprint tickets via JQL | `bash .agents/skills/myccs-workflow/scripts/jira-list.sh` |
| `scripts/jira-fetch.sh` | Fetch summary, status, and description for a `SCRUM-*` ticket | `bash .agents/skills/myccs-workflow/scripts/jira-fetch.sh SCRUM-12` |
| `scripts/jira-transition.sh` | Idempotently transition a Jira ticket status | `bash .agents/skills/myccs-workflow/scripts/jira-transition.sh SCRUM-12 "In Review"` |

### Graphify (`graphify-out/`)
| Script | Purpose | Example |
|---|---|---|
| `scripts/graphify-query.sh` | Run BFS query against `graphify-out/graph.json` | `bash .agents/skills/myccs-workflow/scripts/graphify-query.sh "How does web-admin connect to Supabase?"` |
| `scripts/graphify-update.sh` | Run zero-cost AST update (`graphify update .`) + export HTML | `bash .agents/skills/myccs-workflow/scripts/graphify-update.sh` |
| `scripts/graphify-stats.sh` | Print summary and top God Nodes from `GRAPH_REPORT.md` | `bash .agents/skills/myccs-workflow/scripts/graphify-stats.sh` |

### OpenSpec (`openspec/`)
| Script | Purpose | Example |
|---|---|---|
| `scripts/openspec-status.sh` | List active OpenSpec changes or inspect one change | `bash .agents/skills/myccs-workflow/scripts/openspec-status.sh [change-name]` |
| `scripts/openspec-validate.sh` | Validate OpenSpec change artifacts and `SCRUM-*` traceability | `bash .agents/skills/myccs-workflow/scripts/openspec-validate.sh <change-name>` |

### GitHub (`issues`, `pr`, `release`, `ship`)
| Script | Purpose | Example |
|---|---|---|
| `scripts/gh-issues.sh` | List open issues or create a `SCRUM-*`-linked GitHub issue | `bash .agents/skills/myccs-workflow/scripts/gh-issues.sh list` |
| `scripts/gh-pr.sh` | Create a `SCRUM-*` PR, check CI gates, or Squash & Merge | `bash .agents/skills/myccs-workflow/scripts/gh-pr.sh create develop` |
| `scripts/gh-release.sh` | Cut a tagged GitHub Release on `main` with release notes | `bash .agents/skills/myccs-workflow/scripts/gh-release.sh v1.0.0` |
| `scripts/gh-ship.sh` | Run gates, push branch, open PR, and watch CI checks | `bash .agents/skills/myccs-workflow/scripts/gh-ship.sh develop` |

## Standard Workflows

### 1. Resolve a Jira Ticket & Ship
1. Inspect with `jira-list.sh` / `jira-fetch.sh SCRUM-<N>` and transition to `"In Progress"`.
2. Branch from `develop`: `git checkout -b <type>/SCRUM-<N>-<kebab-slug>`.
3. If spec-driven, validate OpenSpec artifacts with `openspec-validate.sh <change-name>`.
4. Implement following `rules.md` (atomic client + `supabase/` migrations with RLS + explicit `GRANT`s).
5. Run `graphify-update.sh` after code edits, then ship with `gh-ship.sh develop` and transition Jira to `"In Review"`.

### 2. Cut a Release (`develop` -> `main`)
1. Open and merge the release PR (`develop` -> `main`) once staging QA (Expo EAS + Cloudflare Pages `web-admin/` + Supabase staging) passes.
2. Confirm post-merge `push` to `main` completes Phase 5 Production CD.
3. Run `gh-release.sh vX.Y.Z` on `main` and transition linked `SCRUM-*` tickets to `"Done"`.

## Guardrails

- Never push directly to `main` or `develop`; always use **Squash and Merge** for `develop`.
- Never merge a PR with failing or pending CI Phase 1–3 checks.
- Keep `web-admin/` (Cloudflare Pages Vite SPA) excluded from the Expo mobile bundle, and enforce `@lpunetwork.edu.ph` auth + RA 10173 PII encryption server-side.
- See [references/workflow-and-ci.md](references/workflow-and-ci.md) for full CI gates, OpenSpec, and Graphify guidance.
