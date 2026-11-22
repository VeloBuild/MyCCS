# Git Branching & Version Control Strategy: MyCCS

* **Project:** MyCCS (Mobile App + Standalone `web-admin/` Portal)
* **Prepared By:** Alexis John Rellon (QA/DevOps)
* **Status:** Updated — Aligned with PRD & SAB
* **Date:** 2026-11-22
* **Related Specifications:**
  * [Product Requirements Document (`PRD_MyCCS.md`)](./PRD_MyCCS.md)
  * [Software Architecture Baseline (`SCRUM-9`)](./Software_Architecture_Baseline.md)
  * [CI/CD Pipeline Specification](./CI_CD%20Pipeline%20Specification_%20Centralized%20Department%20Mobile%20App.md)

---

## 1. Overview

To support a 4-sprint velocity across the Expo mobile app, the standalone `web-admin/` portal, and Supabase backend without destabilizing production, MyCCS uses a Three-Tier Integration Flow (`transient` -> `develop` -> `main`).

---

## 2. The Branching Model

The repository maintains two permanent protected branches and short-lived transient branches:

* **`main` (Production — Protected):** Production-ready state live to students, officers, and faculty. Receives merges exclusively from `develop` (release cutovers) or `hotfix/*` branches via PR. Post-merge `push` to `main` triggers production CD.
* **`develop` (Integration & QA — Protected):** Active integration branch. All completed feature and bugfix PRs squash-merge here. Post-merge `push` to `develop` triggers staging deployment (Expo EAS staging `.apk`, staging `web-admin/`, and staging Supabase).
* **Transient Branches:** Short-lived branches created from `develop` (or from `main` for `hotfix/*`). All active coding happens here and merges back via Pull Request.

---

## 3. Branch Naming Conventions

All transient branches must include a valid `SCRUM-*` Jira ticket key using:

`<type>/SCRUM-<number>-<kebab-case-description>`

| Type | Use Case | Example |
| :--- | :--- | :--- |
| `feat/` | New features or user stories | `feat/SCRUM-12-offline-qr-scanner` |
| `fix/` | Bug fixes targeting `develop` | `fix/SCRUM-18-offline-sync-clock-offset` |
| `hotfix/` | Emergency production fixes targeting `main` | `hotfix/SCRUM-22-sso-login-failure` |
| `chore/` | Config, CI/CD, or dependency bumps | `chore/SCRUM-27-fix-ci-deploy-trigger` |
| `refactor/` | Structural code changes | `refactor/SCRUM-30-extract-shared-zod` |

---

## 4. Commit Message Standards (Conventional Commits)

MyCCS enforces Conventional Commits with mandatory `SCRUM-*` Jira keys via `.husky/commit-msg` to keep Git history readable and automate release notes.

**Format:** `<type>(<scope>): [SCRUM-<number>] <short description>`
*(Scope is optional: `<type>: [SCRUM-<number>] <short description>` is also valid; `.husky/commit-msg` must match this rule.)*

* **Type:** `feat`, `fix`, `hotfix`, `chore`, `refactor`, `docs`, `test`
* **Scope (Optional):** Module or workspace (`mobile`, `web-admin`, `shared`, `auth`, `qr`, `forms`, `gmetrix`, `db`, `ci`)
* **Description:** Imperative mood, lowercase, no trailing period.

**Valid Examples:**
* `feat(qr): [SCRUM-12] implement offline sqlite attendance scan queue`
* `feat(web-admin): [SCRUM-19] add gmetrix csv upload and rejected rows download`
* `fix(ci): [SCRUM-27] run production deploy on push to main instead of pull_request`
* `chore: [SCRUM-20] add initial supabase migration with rls and grants`

---

## 5. Monorepo & Atomic Commit Rules

The repository isolates deployable surfaces while keeping schema and backend logic version-controlled together:
* Root workspace: Expo React Native mobile app
* `web-admin/`: Standalone Web Admin portal (excluded from mobile bundles; deployed via cloud host directory selection)
* `shared/`: Shared TypeScript types and Zod validation schemas
* `supabase/migrations/` & `supabase/functions/`: Database SQL migrations and Deno Edge Functions

### The Atomic Commit Rule
When a feature requires a database schema change, RLS policy, `GRANT` statement, or Edge Function update:
1. Generate the SQL migration under `supabase/migrations/` (including explicit `GRANT` statements for `authenticated` alongside RLS policies, as required by Supabase's default table exposure config).
2. Commit the client code (mobile and/or `web-admin/`), `shared/` schema updates, and `supabase/` migration or Edge Function changes in the **same commit / PR**.
3. Reviewers validate UI/API changes, RLS policies, and encryption/blind-index rules simultaneously.

---

## 6. Pull Request & Merge Rules (CI/CD Gate)

Direct pushes to `main` and `develop` are blocked. Every change enters via Pull Request:

1. **Jira Linking:** PR title must include the Jira ticket key (e.g., `SCRUM-12`) to transition the ticket to *In Review*.
2. **Required Automated Checks:** PRs cannot merge until all CI checks pass (Typecheck, CodeRabbit AI, CodeQL, Snyk, Jest, Newman, and Playwright E2E for `web-admin/`).
3. **Squash and Merge:** All PRs targeting `develop` must use **Squash and Merge** to maintain a clean feature-level integration history.

---

## 7. Approval Sign-off

* **Lead DevOps Engineer:** Alexis John Rellon
* **QA Lead:** Jaermaine Domingcil
* **Project Manager:** [caparasmarkrisen.mrc@gmail.com](mailto:caparasmarkrisen.mrc@gmail.com)
