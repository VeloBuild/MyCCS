# Docs Directory Agent Instructions (`docs/`)

## Purpose

Holds product, architecture, and delivery specifications under `docs/jira/` plus UI design tokens (`docs/design-token.json`).

## Single Source of Truth (SSOT) Boundaries

Never duplicate schemas, diagrams, or pipeline rules across files. Put each change in its owning document and link from the others:

| File | Owns |
| :--- | :--- |
| `docs/jira/PRD_MyCCS.md` | Functional requirements, user roles (`student`, `officer`, `admin`), MVP vs. Phase 2 scope, acceptance criteria. |
| `docs/jira/Software_Architecture_Baseline.md` (`SCRUM-9`) | System/container diagrams, unified PostgreSQL ERD, RBAC, offline QR sync, GMetrix CSV import, encryption + blind index, ADRs. |
| `docs/jira/College Department App - Agile Project Brief_Proposal.md` | Executive vision, SMART objectives, 4-sprint roadmap, team allocation. |
| `docs/jira/CI_CD Pipeline Specification_ Centralized Department Mobile App.md` | DevSecOps phases (0–5), PR CI gates, post-merge CD for EAS, `web-admin/`, and Supabase. |
| `docs/jira/Git Branching & Version Control Strategy.md` | `main`/`develop`/`<type>/SCRUM-*` branching, Conventional Commits, Atomic Commit Rule, Squash & Merge. |

## Conventions

- Keep all docs in Markdown (Documentation as Code). Do not commit stale binary `.pdf` exports alongside `.md` sources.
- Use `SCRUM-*` Jira keys and `MyCCS` naming consistently across all documents.
- Follow repo-wide rules in [../rules.md](../rules.md).
