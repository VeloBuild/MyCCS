# CI/CD Pipeline Specification: MyCCS

## Document Metadata

* **Document Type:** DevOps & QA Architecture Specification
* **Project:** MyCCS (Mobile App + Standalone `web-admin/` Portal)
* **Prepared By:** Alexis John L. Rellon
* **Status:** Updated — Aligned with PRD & SAB
* **Version:** 2.0.0
* **Last Updated:** 2026-11-22
* **Related Specifications:**
  * [Product Requirements Document (`PRD_MyCCS.md`)](./PRD_MyCCS.md)
  * [Software Architecture Baseline (`SCRUM-9`)](./Software_Architecture_Baseline.md)
  * [Git Branching & Version Control Strategy](./Git%20Branching%20%26%20Version%20Control%20Strategy.md)

---

## 1. Overview

This document defines the Continuous Integration (CI) and Continuous Deployment (CD) pipeline for MyCCS. Built around a DevSecOps workflow, the pipeline validates the Expo React Native mobile app, the standalone `web-admin/` portal, and Supabase database migrations and Edge Functions.

**Critical Separation Rule:** Pull Request workflows (`on: pull_request`) run **CI validation only**. Deployment jobs (`Phase 5`) run **strictly on post-merge `push` events** to `develop` (staging) and `main` (production)—never while a PR is still open.

---

## 2. Technology Stack Summary

| Category | Tooling / Platform | Purpose |
| :--- | :--- | :--- |
| **Source Control** | GitHub | Monorepo hosting and GitHub Actions orchestration |
| **Project Tracking** | Jira (`SCRUM-*`) | Issue tracking and automated status transitions |
| **Security (SCA/SAST)** | Snyk, CodeQL | Dependency vulnerability scanning and static code analysis |
| **AI Code Review** | CodeRabbit AI | Automated PR diff review and architectural checks |
| **Testing Frameworks** | Jest, Newman, Playwright | Unit/component (Mobile + Web), Supabase API/Edge Function contract tests, and `web-admin/` E2E tests |
| **Mobile Build** | Expo EAS | Cloud Android `.apk`/`.aab` and iOS `.ipa` builds + OTA updates |
| **Web Admin Hosting** | Cloudflare Pages | Independent cloud deployment pointing directly to `web-admin/` Vite SPA root directory (excluded from mobile bundle; zero backend secrets on Cloudflare) |
| **Backend Infrastructure** | Supabase CLI | PostgreSQL migrations (`RLS` + explicit `GRANT`s) and Deno Edge Functions (`compress-image`, `import-gmetrix-keys`) |

---

## 3. Pipeline Architecture Phases

### Phase 0: Continuous Dependency Maintenance
* **Dependabot Configuration:** Controlled via `.github/dependabot.yml` covering both root mobile `package.json` and `web-admin/package.json`.
* **Execution:** Weekly/daily scheduled scans generating dependency upgrade PRs that trigger the full CI suite.

### Phase 1: PR Initiation & Jira Synchronization (CI)
* **Trigger:** `pull_request` targeting `develop` or `main`.
* **Jira Integration:** Branch name and PR title must include a valid Jira key matching `SCRUM-<number>` (e.g., `SCRUM-12`).
* **Automation:** GitHub Actions validates the Jira key and transitions the corresponding Jira issue from **In Progress** to **In Review**.

### Phase 2: Static Analysis & DevSecOps Gateway (CI)
* **TypeScript & Lint:** Runs `tsc --noEmit` across mobile, `shared/`, and `web-admin/`.
* **CodeRabbit AI:** Performs automated diff review for logic and architecture issues.
* **CodeQL (SAST):** Scans TypeScript and Deno Edge Functions for injection, auth bypass, and PII leakage.
* **Snyk (SCA):** Audits npm dependencies across root and `web-admin/` against known vulnerabilities.

### Phase 3: Automated QA Gateway (CI)
Runs in parallel to minimize PR feedback latency:
* **Unit Tests (Jest):** Validates mobile components, offline SQLite sync logic, conditional form Zod schemas, and shared utilities.
* **API & Edge Function Tests (Newman):** Runs Postman collections against Supabase REST endpoints, RLS policies, `compress-image`, and `import-gmetrix-keys` (including CSV partial-commit and rejected-row sanitization).
* **E2E Web Admin Tests (Playwright):** Runs headless browser tests against `web-admin/` covering `@lpunetwork.edu.ph` admin login, RBAC enforcement, faculty role promotion, GMetrix CSV upload, and rejected-row CSV download.

### Phase 4: Staging Mobile Build & QA Handoff (Post-Merge to `develop`)
* **Trigger:** `push` to `develop` after Squash & Merge.
* **Expo EAS Preview Build:** Generates a staging Android `.apk` (and/or iOS internal build) and posts the build artifact/QR link for physical-device QA (camera QR scanning, offline SQLite sync, push notifications).
* **Staging Web Admin & Supabase:** Deploys `web-admin/` preview and applies migrations/Edge Functions to the Supabase staging project.

### Phase 5: Production Continuous Deployment (Post-Merge to `main`)
* **Trigger:** `push` to `main` after release PR approval and merge (never on `pull_request`).
* **Jira Transition:** Transitions linked `SCRUM-*` tickets to **Done**.
* **Backend (Supabase):** Applies `supabase/migrations/` and deploys Edge Functions (`compress-image`, `import-gmetrix-keys`) to production.
* **Web Admin (`web-admin/`):** Triggers production deploy on **Cloudflare Pages** using `web-admin/` as the configured root directory.
* **Mobile (Expo EAS):** Publishes OTA JS updates for non-native changes or queues production store builds for native changes.

---

## 4. Branch Protection & Required Checks

Branch protection on `develop` and `main` (tracked in `scripts/branch-protection-body.json`) must require all CI gates to pass before merge:
1. Phase 1: Jira Key & PR Title Check
2. Phase 2: Typecheck, CodeQL, and Snyk
3. Phase 3: Jest Unit Tests, Newman API Tests, and Playwright E2E Tests

---

## 5. Approval Sign-off

* **Lead DevOps Engineer:** [Alexis John Rellon](mailto:alexisrellon.dev@gmail.com)
* **QA Lead:** Jaermaine Domingcil
* **Project Manager:** [caparasmarkrisen.mrc@gmail.com](mailto:caparasmarkrisen.mrc@gmail.com)
