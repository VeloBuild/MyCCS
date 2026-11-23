# MyCCS OpenSpec SDD Roadmap, Spec Checklist & Bug Tracker

Single living tracker for implementing MyCCS spec-by-spec using OpenSpec (`schema: spec-driven`) under **Ponytail rules** (smallest complete change per spec; no speculative abstractions; never cut validation, security, or data-loss protection).

- **Authoritative Specs:** [PRD_MyCCS.md](../docs/jira/PRD_MyCCS.md) · [Software_Architecture_Baseline.md](../docs/jira/Software_Architecture_Baseline.md) · [rules.md](../rules.md)
- **OpenSpec Workflow:** `.agents/skills/myccs-workflow/scripts/openspec-status.sh` & `openspec-validate.sh`

---

## Ponytail Implementation Rules (Apply to Every Spec)

1. **Smallest complete slice:** Build only what the spec requires. No extra options, wrappers, or "for later" hooks.
2. **Never cut:** Trust-boundary validation (Zod + server-side checks), RA 10173 PII encryption / blind index, PostgreSQL RLS + explicit `GRANT`s, offline data-loss guards.
3. **One small check per non-trivial change:** Every new branch, parser, RLS policy, Edge Function, or offline queue rule ships with a focused Jest / Newman / Playwright test.
4. **Explicit shortcuts:** Any intentional MVP limit gets a code comment `shortcut: <limit>, <when to upgrade>` and a row in the Shortcut Ledger below.
5. **Atomic commits:** Client (`mobile` / `web-admin/`), `shared/`, and `supabase/` (migrations + Edge Functions) land in the same `SCRUM-*` commit/PR.

---

## Milestones & Per-Spec Checklist

### Milestone 1 — Foundation, Auth & Security (Sprint 1)
*Exit gate: Verified `@lpunetwork.edu.ph` user can sign up with 6-digit OTP, receive encrypted profile + QR token, and `admin` can log into `web-admin/` on Cloudflare Pages.*

- [ ] **`spec-01-auth-identity`** (`FR-AUTH`, `ADR-008`, `ADR-011`)
  - [ ] Server-side `before-user-created` Auth Hook enforcing `@lpunetwork.edu.ph` (reject all other domains)
  - [ ] Resend custom SMTP configured for 6-digit signup OTP (`enable_signup = true`, `enable_confirmations = true`)
  - [ ] Encrypted `profiles` (`email_enc`, `full_name_enc`, `student_id_enc`, `email_blind_index`, `key_version`, `qr_token`, `role`) + RLS + explicit `GRANT`s
  - [ ] SQL seed for initial Department Admin(s) + Expo SecureStore session flow
  - [ ] Tests: domain rejection, OTP verification, blind-index lookup, `student_id` privacy
- [ ] **`spec-02-core-schema-rls`** (`SAB §6`, `ADR-005`)
  - [ ] Migrations for `department_info`, `organizations` (`parent_org_id` for Main -> Sub-Org), `org_memberships`, `announcements`
  - [ ] 3-role RBAC RLS policies (`student | officer | admin`) + explicit `GRANT`s for `authenticated`
  - [ ] Tests: Newman RLS positive/negative access checks per role
- [ ] **`spec-03-web-admin-scaffold`** (`ADR-009`)
  - [ ] Standalone Vite + React + TypeScript SPA in `web-admin/` (strictly excluded from Metro/EAS bundle)
  - [ ] `shared/` directory for shared TypeScript DTOs and Zod schemas
  - [ ] Admin login + route guard (`role = 'admin'`) + Cloudflare Pages root-directory config + Edge Function CORS allowlist
  - [ ] Tests: Playwright smoke test verifying non-admin `@lpunetwork.edu.ph` student is blocked from `web-admin/`

---

### Milestone 2 — Org Hub, Media & GMetrix Distribution (Sprint 2)
*Exit gate: Students view Dept About & Org/Sub-Org pages; Faculty upload a 500-row GMetrix CSV on `web-admin/` with push alerts for registered students and sanitized fallback CSV for unregistered rows.*

- [ ] **`spec-04-dept-and-org-pages`** (`FR-DEPT`, `FR-ORG`)
  - [ ] Department "About" screen (admin-editable) + Announcements feed with `expires_at`
  - [ ] Main Org -> Sub-Org directory & simplified org page (cover image, logo, details, chronological posts — no likes/comments)
  - [ ] On-device pre-compression (`expo-image-manipulator`) + `POST /functions/v1/compress-image` (JWT/role check, EXIF strip, WebP, 5 MB cap)
  - [ ] Tests: `compress-image` JWT/role/MIME/size rejection tests (Newman)
- [ ] **`spec-05-gmetrix-csv-and-push`** (`FR-CERT`)
  - [ ] Migrations for `certifications`, `certification_key_batches`, `certification_keys` (encrypted `key_code_enc` + `key_code_hash`), `notifications`, `push_tokens`
  - [ ] `POST /functions/v1/import-gmetrix-keys`: blind-index email matching, idempotent partial commit, formula-injection sanitization (`=`, `+`, `-`, `@`) on rejected-rows CSV
  - [ ] `web-admin/` CSV upload UI, summary counts, downloadable rejected-rows CSV prompt (email/MS Teams fallback), and faculty-to-admin promotion UI
  - [ ] Content-free Expo Push Notification + authenticated mobile "My Keys" screen (raw key never in push payload)
  - [ ] Tests: Newman CSV partial-commit/duplicate/injection tests + Playwright `web-admin/` upload E2E

---

### Milestone 3 — Events, Offline Attendance & Conditional Forms (Sprint 3)
*Exit gate: Officers scan permanent student QRs offline with check-in/check-out, cooldown, and auto-checkout; orgs run conditional membership and post-event evaluation forms with host metrics.*

- [ ] **`spec-06-events-and-offline-qr`** (`FR-EVT`, `FR-ATT`, `ADR-004`, `ADR-006`)
  - [ ] Migrations for `events` (`modality`, `meeting_url`, window/cooldown/auto-checkout fields), `event_registrations`, `attendance_scans`, `attendance_records`
  - [ ] Onsite & online event screens (validated Zoom/Meet/Teams URLs for online)
  - [ ] Offline SQLite `attendance_scans` queue (`client_scan_id` UUID), pre-event `clock_offset_ms` + minimal display-name roster cache
  - [ ] Opaque permanent QR (`v1.<profile_id>.<short_hmac>`) scanner with cooldown guard, visual name display, officer rescan check-out, and server-side reconciliation + auto-checkout job
  - [ ] Tests: Jest unit tests for `clock_offset_ms`, cooldown suppression, multi-officer reconciliation, and auto-checkout
- [ ] **`spec-07-conditional-forms-metrics`** (`FR-FORM`, `ADR-010`)
  - [ ] Migrations for `forms` (`schema_json`), `form_submissions` (`UNIQUE(form_id, profile_id)`)
  - [ ] Shared Zod JSONB schema bounded to 4 field types (`short_text`, `single_choice`, `multi_choice`, `rating_1_5`) + 1-level `visibleIf: { fieldId, equals }`
  - [ ] Org membership application submit & officer approve/reject flow (`pending | approved | rejected`)
  - [ ] Post-event evaluation submit + PostgreSQL RPC/view for host metrics (response count, rating averages, option distributions)
  - [ ] Tests: Jest Zod schema & conditional visibility tests + Newman RPC aggregation tests

---

### Milestone 4 — Hardening, QA & Production Cutover (Sprint 4)
*Exit gate: All CI Phases 1–3 green, physical-device offline QA passed, `v1.0.0` released on `main`.*

- [ ] **`spec-08-qa-security-release`** (`CI/CD Spec §3–5`)
  - [ ] Wire real Newman (`tests/api/`) and Playwright (`tests/e2e/`) commands in `.github/workflows/ci.yml` (replace echo stubs)
  - [ ] Configure Expo EAS `eas.json` (`preview`, `production`) and Cloudflare Pages production deploy
  - [ ] Physical device QA: zero-connectivity QR scan + reconnect sync, push notification deep link, `web-admin/` CSV import
  - [ ] Security audit: CodeQL, Snyk (`continue-on-error: false` once clean), RA 10173 PII check, key rotation dry run
  - [ ] Release PR `develop` -> `main`, post-merge Phase 5 CD verification, tag `v1.0.0` via `gh-release.sh`

---

## Implementation Bug Log

Record every bug found during audit or implementation here so root causes are fixed once in shared code.

| ID | Date | Spec / Area | Symptom | Root Cause | Fix / Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | 2026-11-22 | CI/CD (`.github/workflows/ci.yml`) | `Phase 5 · Deploy` triggered on open `pull_request` to `main` (pre-merge deploy) | Workflow only listened to `pull_request` and checked `github.base_ref == 'main'` | **Fixed** — Added `push` triggers and gated Phases 4–5 strictly on `github.event_name == 'push'`. |
| **BUG-002** | 2026-11-22 | Git Hook (`.husky/commit-msg`) | Rejected scope-less commits allowed by `Git Branching Strategy §4` and showed `CCS-42` examples | Regex required `(<scope>)` and used generic `[A-Z]+` examples | **Fixed** — Made `(scope)` optional, added `docs`/`test`, enforced `[SCRUM-<number>]`. |
| **BUG-003** | 2026-11-22 | Branch Protection (`scripts/branch-protection-body.json`) | Required checks omitted Jira validation and Playwright E2E | Contexts list out of sync with `.github/workflows/ci.yml` | **Fixed** — Added `Phase 1 · Jira Ticket Validation` and `Phase 3 · Playwright E2E Tests`. |
| **BUG-004** | 2026-11-23 | Auth Config (`supabase/config.toml`) | Email signup/confirmation disabled while MS 365 IdP OAuth clearance is unavailable | Spec originally assumed direct University Entra ID OAuth | **Fixed** — Enabled `[auth.email] enable_signup = true` & `enable_confirmations = true` for `@lpunetwork.edu.ph` OTP auth + server-side hook. |
| **BUG-005** | 2026-11-22 | Docs (`docs/jira/Software_Architecture_Baseline.pdf`) | Stale v1.0 PDF lingered alongside v2.0 `.md` | Sandbox file-delete restriction on Windows | **Fixed** — Deleted stale `Software_Architecture_Baseline.pdf` and scrubbed remaining stale `Vercel`/`Netlify`/`Institutional SSO` lines across `docs/jira/*.md`. |
| **BUG-006** | 2026-11-23 | TypeScript (`tsconfig.json`) | `npx tsc --noEmit` failed on `tests/unit/App.test.tsx` (`Cannot find name 'describe'/'it'/'expect'`) | TypeScript 6.0 defaults `compilerOptions.types` to `[]`, excluding `@types/jest` globals | **Fixed** — Added `"types": ["jest"]` to `tsconfig.json`. |

---

## Ponytail Shortcut Ledger

Track intentional MVP shortcuts (`shortcut: <limit>, <when to upgrade>`) so debt stays visible:

| Spec | Shortcut (`limit`) | When to Upgrade |
| :--- | :--- | :--- |
| `spec-04-dept-and-org-pages` | Org pages are read-only chronological posts (no likes, comments, or drag-and-drop builder) | Phase 2 if orgs request interactive discussions |
| `spec-05-gmetrix-csv-and-push` | Unregistered CSV rows are returned for manual email/MS Teams delivery (no automated email send) | Phase 2 when Resend transactional email notifications are added |
| `spec-07-conditional-forms-metrics` | Form builder capped at 4 field types + 1-level `visibleIf` equality (no AND/OR trees or file uploads) | Phase 2 if complex multi-branch evaluations are required |
