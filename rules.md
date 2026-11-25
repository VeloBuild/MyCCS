# MyCCS Repository Rules

Authoritative engineering, security, privacy, and delivery rules for MyCCS (Expo React Native mobile app + standalone `web-admin/` portal + Supabase backend).

---

## 1. Architecture & Monorepo Boundaries

* **Standalone `web-admin/`:** Faculty/Admin GMetrix CSV portal is a standalone Vite + React SPA in `web-admin/`, deployed independently to **Cloudflare Pages** (zero backend secrets on Cloudflare; strict Edge Function CORS allowlist). Never bundle `web-admin/` into the Expo mobile build.
* **Shared Contracts:** Put shared TypeScript types and Zod schemas (form builder, CSV validation, DTOs) in `shared/`.
* **Strict TypeScript:** Keep `strict: true` across mobile, `web-admin/`, and `shared/`. No untyped `any` in domain or API boundaries.
* **SSOT Documentation:** Follow the Single Source of Truth boundaries in [docs/AGENTS.md](docs/AGENTS.md) — do not duplicate schemas or CI/CD rules across docs.

## 2. Security & Data Privacy (RA 10173)

* **Never Trust the Client:** Enforce all authorization via PostgreSQL RLS and JWT-verified Supabase Edge Functions (`student | officer | admin`; faculty operate under `admin`).
* **Verified Institutional Email Auth (`@lpunetwork.edu.ph`):** Keep `[auth.email] enable_signup = true` and `enable_confirmations = true` in `supabase/config.toml` with Resend custom SMTP (6-digit signup OTP) and a server-side `before-user-created` Auth Hook restricting signups to `@lpunetwork.edu.ph` (never client-only regex). Initial admins are SQL-seeded; admins promote verified faculty inside `web-admin/`.
* **PII Encryption & Blind Index:** Encrypt student PII (`email`, `full_name`, `student_id`) and `certification_keys.key_code` at rest with `key_version` rotation. Keep `student_id` private; match GMetrix CSV rows strictly via HMAC-SHA256 `email_blind_index`.
* **No Secrets or PII in Payloads:**
  * Never put raw GMetrix keys inside Expo Push Notification payloads (deep link only).
  * Never encode raw `student_id`, `email`, or `full_name` in permanent student QR codes (use opaque signed tokens `v1.<profile_id>.<short_hmac>`).
  * Sanitize exported CSV fields against spreadsheet formula injection (`=`, `+`, `-`, `@`).
* **Sensitive File Guard:** Never read, print, log, or commit `.env*`, `*.pem`, `*.key`, `secrets.*`, `credentials.*`, or `google-services.json`.

## 3. Database & Media Rules

* **Mandatory RLS + Explicit `GRANT`:** Every migration creating a `public` table must enable RLS and issue explicit `GRANT` statements for `authenticated`.
* **Atomic Commit Rule:** Commit client changes (`mobile` / `web-admin/`), `shared/` schemas, `supabase/migrations/`, and `supabase/functions/` in the same commit/PR.
* **Image Compression:** Route org cover images, logos, and event flyers through on-device pre-compression + `POST /functions/v1/compress-image` (JWT/role check, EXIF strip, WebP normalization).

## 4. Offline Attendance Rules

* **Append-Only Scans + Materialized Records:** Queue officer scans in local SQLite (`attendance_scans` with `client_scan_id` UUID and pre-synced `clock_offset_ms`) and reconcile into `attendance_records` (`checked_in_at`, `checked_out_at`, `checkout_source`: `'scan' | 'auto'`).
* **Cooldown & Auto-Checkout:** Enforce organizer-configured cooldowns, on-time/late/absent windows, officer rescan check-out, and automatic check-out timeout.

## 5. Git, Jira & CI/CD Hygiene

* **Branches:** `<type>/SCRUM-<number>-<kebab-case>` targeting `develop` (`hotfix/*` targets `main`). Direct pushes to `main` and `develop` are blocked.
* **Commits:** `<type>(<scope>): [SCRUM-<number>] <short description>` (scope optional; enforced by `.husky/commit-msg`).
* **Merge Policy:** Squash and Merge all PRs targeting `develop`.
* **CodeRabbit PR Review Gate:** After opening a PR (or pushing new commits) and before Squash & Merge, trigger an actual CodeRabbit review via `bash .agents/skills/coderabbit-pr-gate/scripts/trigger-coderabbit-review.sh [PR_NUMBER] --wait` (OSS repos with `< 10` stars skip auto-review) and resolve critical findings.
* **CI vs. CD Separation:** `pull_request` workflows run CI only (Phases 1–3). Builds and deploys (Phases 4–5) run strictly on post-merge `push` to `develop`/`main`.

---

## Authoritative References

* [PRD (`docs/jira/PRD_MyCCS.md`)](docs/jira/PRD_MyCCS.md)
* [Software Architecture Baseline (`docs/jira/Software_Architecture_Baseline.md`)](docs/jira/Software_Architecture_Baseline.md)
* [CI/CD Pipeline Specification](docs/jira/CI_CD%20Pipeline%20Specification_%20Centralized%20Department%20Mobile%20App.md)
* [Git Branching & Version Control Strategy](docs/jira/Git%20Branching%20%26%20Version%20Control%20Strategy.md)
