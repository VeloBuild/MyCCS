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

- [x] **`spec-01-auth-identity`** (`FR-AUTH`, `ADR-008`, `ADR-011`)
  - [x] Server-side `before-user-created` Auth Hook enforcing `@lpunetwork.edu.ph` (reject all other domains)
  - [x] Resend custom SMTP configured for 6-digit signup OTP (`enable_signup = true`, `enable_confirmations = true`)
  - [x] Encrypted `profiles` (`email_enc`, `full_name_enc`, `student_id_enc`, `email_blind_index`, `key_version`, `qr_token`, `role`) + RLS + explicit `GRANT`s
  - [x] SQL seed for initial Department Admin(s) + Expo SecureStore session flow
  - [x] Tests: domain rejection, OTP verification, blind-index lookup, `student_id` privacy
- [x] **`spec-02-core-schema-rls`** (`SAB §6`, `ADR-005`)
  - [x] Migrations for `department_info`, `organizations` (`parent_org_id` for Main -> Sub-Org), `org_memberships`, `announcements`
  - [x] 3-role RBAC RLS policies (`student | officer | admin`) + explicit `GRANT`s for `authenticated`
  - [x] Tests: Newman RLS positive/negative access checks per role
- [x] **`spec-03-web-admin-scaffold`** (`ADR-009`)
  - [x] Standalone Vite + React + TypeScript SPA in `web-admin/` (strictly excluded from Metro/EAS bundle)
  - [x] `shared/` directory for shared TypeScript DTOs and Zod schemas
  - [x] Admin login + route guard (`role = 'admin'`) + Cloudflare Pages root-directory config + Edge Function CORS allowlist
  - [x] Tests: Playwright smoke test verifying non-admin `@lpunetwork.edu.ph` student is blocked from `web-admin/`

---

### Milestone 2 — Org Hub, Media & GMetrix Distribution (Sprint 2)
*Exit gate: Students view Dept About & Org/Sub-Org pages; Faculty upload a 500-row GMetrix CSV on `web-admin/` with push alerts for registered students and sanitized fallback CSV for unregistered rows.*

- [x] **`spec-04-dept-and-org-pages`** (`FR-DEPT`, `FR-ORG`)
  - [x] Department "About" screen (admin-editable) + Announcements feed with `expires_at`
  - [x] Main Org -> Sub-Org directory & simplified org page (cover image, logo, details, chronological posts — no likes/comments)
  - [x] On-device pre-compression (`expo-image-manipulator`) + `POST /functions/v1/compress-image` (JWT/role check, EXIF strip, WebP, 5 MB cap)
  - [x] Tests: `compress-image` JWT/role/MIME/size rejection tests (Newman)
- [ ] **`spec-05-gmetrix-csv-and-push`** (`FR-CERT`)
  - [ ] Migrations for `certifications`, `certification_key_batches`, `certification_keys` (encrypted `key_code_enc` + `key_code_hash`), `notifications`, `push_tokens`
  - [ ] `POST /functions/v1/import-gmetrix-keys`: blind-index email matching, idempotent partial commit, formula-injection sanitization (`=`, `+`, `-`, `@`) on rejected-rows CSV
  - [ ] `web-admin/` CSV upload UI, summary counts, downloadable rejected-rows CSV prompt (email/MS Teams fallback), and faculty-to-admin promotion UI
  - [ ] Content-free Expo Push Notification + authenticated mobile "My Keys" screen (raw key never in push payload)
  - [ ] Tests: Newman CSV partial-commit/duplicate/injection tests + Playwright `web-admin/` upload E2E

---

### Milestone 3 — Events, Offline Attendance & Conditional Forms (Sprint 3)
*Exit gate: Officers scan permanent student QRs offline with check-in/check-out, cooldown, and auto-checkout; open events admit guests via pre-registered or walk-in guest passes; orgs run conditional membership and post-event evaluation forms with host metrics.*

- [ ] **`spec-06-events-and-offline-qr`** (`FR-EVT`, `FR-ATT`, `ADR-004`, `ADR-006`)
  - [ ] Migrations for `events` (`modality`, `meeting_url`, window/cooldown/auto-checkout fields), `event_registrations`, `attendance_scans`, `attendance_records`
  - [ ] Onsite & online event screens (validated Zoom/Meet/Teams URLs for online)
  - [ ] Offline SQLite `attendance_scans` queue (`client_scan_id` UUID), pre-event `clock_offset_ms` + minimal display-name roster cache
  - [ ] Opaque permanent QR (`v1.<profile_id>.<short_hmac>`) scanner with cooldown guard, visual name display, officer rescan check-out, and server-side reconciliation + auto-checkout job
  - [ ] Tests: Jest unit tests for `clock_offset_ms`, cooldown suppression, multi-officer reconciliation, and auto-checkout
- [ ] **`spec-06b-guest-passes`** (`FR-GUEST`, `FR-ATT-06`) — *approved 2026-11-25; implement after `spec-06`*
  - [ ] Migrations: `events.audience` (`ccs_only` default | `open`), `event_guests` (encrypted name/email + blind index, consent, `source`, `over_capacity`, `purged_at`), `event_kiosk_links` (hashed token, expiry, revoke), `attendance_records.guest_id` + one-of CHECK, rate-limit counter + RLS/explicit `GRANT`s (no `anon` table access)
  - [ ] Shared Zod `GuestRegistrationSchema` + `parseAttendanceCode()` (`v1.` member / `g1.` guest)
  - [ ] Edge Functions `register-guest` (Turnstile, rate limit, capacity, dedupe, pass email/kiosk display), `resend-guest-pass`, `create-kiosk-link`; extend attendance sync for walk-ins + `g1` HMAC verification; secrets `GUEST_PASS_HMAC_KEY`, `TURNSTILE_SECRET_KEY`
  - [ ] Public `web-admin/` routes `/e/:eventId` (pre-registration) and `/e/:eventId/kiosk` (walk-in, QR on screen, 20 s reset) outside the admin guard, with no admin imports
  - [ ] Mobile: audience toggle, kiosk link create/revoke, guest roster cache, scanner `g1` results + "unverified guest", offline "Add walk-in", "Rejected scans"
  - [ ] `purge_guest_pii()` daily `pg_cron` job (`GUEST_RETENTION_DAYS`, default 30) + member/guest split in attendance summary
  - [ ] Tests: Jest code parsing & guest scan classification; Newman `register-guest` / kiosk / sync / RLS negatives; SQL purge test; Playwright kiosk + pre-registration
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
| **BUG-007** | 2026-11-23 | OpenSpec Config (`openspec/config.yaml`) | `openspec` CLI warned `Guidance for operation 'apply' must be an array of strings, ignoring this operation's guidance` | Unquoted colon (`Follow ponytail rules: ...`) inside YAML list item under `operations.apply.guidance` parsed as a map instead of a string | **Fixed** — Quoted guidance strings under `operations.apply.guidance` and `operations.archive.guidance` in `openspec/config.yaml`. |
| **BUG-008** | 2026-11-24 | Auth & RLS (`supabase/migrations/20261123000001_spec01_auth_identity.sql`) | `provision_profile`/`seed.sql` fell back to predictable `sha256(current_database())` secrets and `authenticated` had direct `INSERT`/unrestricted `UPDATE` | Missing Vault secret enforcement and overly broad table grants | **Fixed** — Added fail-closed `get_identity_secret()` (Vault-only), revoked direct `INSERT`, added `guard_profiles_immutable_columns()` trigger + `get_my_profile()`, and hardened `seed.sql`. |
| **BUG-009** | 2026-11-24 | Mobile Client (`src/lib/supabase.ts`, `src/screens/AuthIdentityScreen.tsx`) | Dynamic `EXPO_PUBLIC_*` lookup broke Metro static inlining, mount ignored persisted SecureStore sessions, and sign-in omitted QR profile loading | Dynamic bracket env lookup + missing `useEffect` session restore and `get_my_profile` call | **Fixed** — Switched to static `process.env.EXPO_PUBLIC_*`, added 2048-byte SecureStore guard, restored sessions on mount, and loaded `PublicProfileDto` on sign-in. |
| **BUG-010** | 2026-11-24 | Shell Scripts (`.agents/skills/myccs-workflow/scripts/*.sh`) | Git Bash on Windows failed with `set: pipefail\r: invalid option name` | CRLF checkout on `.sh` files without `*.sh text eol=lf` in `.gitattributes` | **Fixed** — Added `*.sh text eol=lf` to `.gitattributes` and normalized `.sh` scripts to LF. |
| **BUG-011** | 2026-11-24 | Auth & RLS (`supabase/migrations/20261123000001_spec01_auth_identity.sql`, `supabase/seed.sql`) | `guard_profiles_immutable_columns` allowed `authenticated` mutations, concurrent soft-delete could race silently, and seeded admin lacked `email_verified` | Trigger ran as `SECURITY DEFINER` (`current_user` always `postgres`), soft-delete `UPDATE` lacked `IF NOT FOUND`, and `seed.sql` omitted `email_verified` | **Fixed** — Hardened `guard_profiles_immutable_columns` against `SECURITY DEFINER` bypass, added `IF NOT FOUND` on concurrent soft-delete, and set `email_verified` in `seed.sql`. |
| **BUG-012** | 2026-11-24 | Mobile Auth (`src/lib/supabase.ts`, `src/screens/AuthIdentityScreen.tsx`) | Real Supabase JWT sessions (>2048 B) threw in SecureStore and interrupted OTP / unprovisioned profile trapped users in a dead-end UI | Hard 2048-byte SecureStore throw without chunking and missing recovery path for verified sessions without a provisioned profile | **Fixed** — Replaced hard 2048-byte throw with chunked SecureStore storage and added recovery flow for interrupted OTP / unprovisioned profiles. |
| **BUG-013** | 2026-11-24 | Auth Config (`supabase/config.toml`) | Department signups hit hourly OTP email rate limit after 2 messages | `[auth.rate_limit] email_sent = 2` capped department-wide OTP delivery | **Fixed** — Raised `[auth.rate_limit] email_sent` in `supabase/config.toml` for department-scale Resend SMTP onboarding. |
| **BUG-014** | 2026-11-24 | DevSecOps & Git Workflow (`scripts/protect-branches.sh`, `.gitattributes`, `.github/workflows/ci.yml`, `gh-release.sh`) | `protect-branches.sh` applied 5 stale checks, `.husky/*` risked Windows CRLF errors, Snyk soft-failed via `continue-on-error: true`, and `gh-release.sh` emitted literal `\n` | Duplicated inline JSON vs `scripts/branch-protection-body.json`, missing `.husky/*` LF rule, unconditional `continue-on-error`, and single-line `\n` `--notes` string | **Fixed** — Wired `protect-branches.sh` to `--input scripts/branch-protection-body.json` (7 checks), added `.husky/* text eol=lf`, enforced conditional Snyk gate without `continue-on-error`, and replaced literal `\n` in `gh-release.sh` with multi-line `NOTES_BODY`. |
| **BUG-015** | 2026-11-24 | Auth Policy & Crypto Bounds (`supabase/config.toml`, `shared/identity-crypto.ts`) | Server allowed 6-char passwords (`minimum_password_length = 6`) & unauthenticated password changes (`secure_password_change = false`) vs 8-char client schema; `identity-crypto.ts` accepted `<16`-byte secrets and `keyVersion > 0xffffffff` | Default Supabase config weaker than `SignupRequestSchema`; missing `MIN_SECRET_BYTES` and 32-bit `keyVersion` upper-bound guards | **Fixed** — Set `minimum_password_length = 8` & `secure_password_change = true` in `config.toml`; enforced `>=16`-byte secrets, `1 <= keyVersion <= 0xffffffff`, and safe `keyRing` lookup in `shared/identity-crypto.ts`. |
| **BUG-016** | 2026-11-24 | QA Config & Tests (`jest.config.js`, `tests/unit/App.test.tsx`, `tests/unit/auth-identity.test.ts`) | Jest lacked coverage threshold enforcement (initial branch coverage 56.07%), `App.test.tsx` was a placeholder (`expect(true)`), and RNTL v14 async `render`/`fireEvent` caused TS2339 errors | No `coverageThreshold` in `jest.config.js`, starter placeholder test, and `@testing-library/react-native` v14 Promise-returning APIs | **Fixed** — Enforced `80/75/80/80` thresholds in `jest.config.js`, wired real `<App />` render test, awaited RNTL v14 APIs, and expanded suite to 18 passing tests (99.15% stmts / 89% branches). |
| **BUG-017** | 2026-11-26 | Web Admin Guard, Metro & CI (`web-admin/src/services/adminAuth.ts`, `web-admin/src/App.tsx`, `metro.config.js`, `playwright.config.ts`, `.github/workflows/ci.yml`) | Global `signOut()` kept tokens in `sessionStorage` on 5xx/offline and logged users out of mobile; non-admin restore fired `SIGNED_OUT` during `loading` and skipped `/access-denied`; unanchored Metro segment regex blocked checkouts under any `web-admin` folder; CI Snyk skipped `web-admin/package.json` | Default `scope: 'global'` sign-out, missing operation counter and `authenticated`-only `SIGNED_OUT` check in `App.tsx`, redundant `webAdminSegmentPattern` regex, and single-workspace Snyk step | **Fixed** — Switched to `signOut({ scope: 'local' })`, added `authOpIdRef` + error boundaries + `formatWebAdminError`, removed `webAdminSegmentPattern`, pinned Playwright to port `4174` with `reuseExistingServer: false`, and added `web-admin` Snyk + root `tsc --noEmit` in CI. |
| **BUG-018** | 2026-11-27 | Media Compression & Storage (`supabase/functions/compress-image/`, `supabase/migrations/20261127000001_spec04_org_media_storage.sql`, `shared/core-schema.ts`) | Chunked uploads bypassed the 5 MiB cap before `formData()`; unauthorized callers allocated 5 MiB and leaked 404 org existence; ImageMagick lacked `ResourceLimits`/explicit format; local Docker `SUPABASE_URL` mismatched JWT `iss` and `verifyUser` skipped `sub` match; empty env vars shadowed fallbacks and WASM fetch skipped `res.ok`; direct table edits to `logo_url`/`cover_url` bypassed `org-media` WebP EXIF stripping and uppercase `HTTPS://` failed `SafeHttpUrlSchema` | Missing streaming byte cap, RBAC run after `arrayBuffer()`, unbounded Magick decode, rigid `supabaseUrl` issuer check, `??` on empty env strings, and unconstrained client updates on org image URL columns | **Fixed** — Added streaming body byte cap, auth/RBAC before `arrayBuffer()` with `403`-first denial, `ResourceLimits` + explicit `MagickFormat`, `SUPABASE_JWT_ISSUER` + `claims.sub === verifiedUser.id` check, `\|\|` env fallbacks + `res.ok` + isolate caching, `guard_organizations_media_urls()` trigger enforcing `org-media` WebP URLs, and case-insensitive `URL` protocol parsing. |
| **BUG-019** | 2026-11-27 | Mobile Hub, Upload & Dates (`src/services/mediaUpload.ts`, `src/services/deptOrg.ts`, `src/lib/supabase.ts`, `src/screens/MyCcsHubScreen.tsx`, `src/components/*.tsx`, `shared/dept-org.ts`) | Mobile upload skipped real post-compression 5 MiB check, broke on Expo Web `FormData`, and leaked native image refs; `YYYY-MM-DD` expirations ran 8 h late in UTC, invalid dates bypassed future check, and `iso.slice(0, 10)` showed wrong Manila dates; empty production `department_info` had no admin create flow; concurrent refreshes/double-taps/org switches raced or leaked drafts; unbounded announcements query lacked `.limit()`; extra `\|` in leadership silently dropped text; mobile Supabase factory missed `service_role` JWT check | Missing `.release()` and post-compression blob/size check, UTC assumptions instead of `Asia/Manila` (`+08:00`), missing `createDepartmentInfo`, missing ref/sequence locks and keyed sub-editors, no query limit, loose pipe count check, and prefix-only key guard | **Fixed** — Added `.release()` cleanup + post-compression size/Web `Blob` handling, calendar-validated `+08:00` `parseOptionalExpiryInput` & `formatManilaDate`, admin `createDepartmentInfo` flow, `refreshIdRef` + `mutatingRef` + keyed `OrgEditPanel`/`OrgPostComposer`, `.limit(100)` on `fetchAnnouncements`, `parts.length > 3` rejection, and `service_role` JWT rejection in `src/lib/supabase.ts`. |
| **BUG-020** | 2026-11-27 | PR #64 Hardening (`supabase/migrations/20261127000001_spec04_org_media_storage.sql`, `supabase/functions/compress-image/`, `src/services/deptOrg.ts`, `src/screens/MyCcsHubScreen.tsx`, `src/components/*.tsx`, `tests/unit/`) | Direct `authenticated` org URL writes could still reference nonexistent `org-media` objects; per-org posts were truncated by the hub feed's 100-item cap; background refresh unmounted active edit forms; `OrgEditPanel` unmount dropped mid-flight media updates; leadership fields with pipes or newlines broke round-trips and edits wiped non-string contact fields; Node 22 cross-realm `ReadableStream` test failed and `<App />` test relied on wall-clock time/ambient env | Missing server-side `service_role` media URL persistence + `storage.objects` trigger check, shared capped hub feed query, shared initial/refresh loading flag, panel-owned media update, naive pipe split and unconditional contact overwrite, and cross-realm Web stream / unfrozen clock in Jest | **Fixed** — Persisted `organizations.logo_url`/`cover_url` via `service_role` in `compress-image` with trigger blocking direct non-NULL `authenticated` writes + verifying `storage.objects`; added uncapped `fetchOrganizationAnnouncements`; separated `loading` vs `refreshing` and moved org media state updates into `MyCcsHubScreen`; added escape-aware leadership parser and dirty-tracked contact fields; fixed Node 22 stream test, env isolation, and frozen clock. |

---

## Ponytail Shortcut Ledger

Track intentional MVP shortcuts (`shortcut: <limit>, <when to upgrade>`) so debt stays visible:

| Spec | Shortcut (`limit`) | When to Upgrade |
| :--- | :--- | :--- |
| `spec-01-auth-identity` | Initial profile PII encryption runs in Postgres `SECURITY DEFINER` RPC (`pgcrypto`) rather than an Edge Function | `spec-05` if Edge Functions need to decrypt `profiles.full_name_enc` directly |
| `spec-02-core-schema-rls` | `org_memberships.submission_id` is a nullable `uuid` without a foreign key constraint | `spec-07-conditional-forms-metrics` when `public.form_submissions` is created (add `REFERENCES public.form_submissions(id) ON DELETE SET NULL`) |
| `spec-03-web-admin-scaffold` | Playwright smoke test mocks Supabase Auth and `get_my_profile` RPC via `page.route` for deterministic CI runs without live credentials | `spec-08-qa-security-release` when adding an optional staging-backed E2E smoke check before `v1.0.0` cutover |
| `spec-04-dept-and-org-pages` | Org pages are read-only chronological posts (no likes, comments, or drag-and-drop builder) | Phase 2 if orgs request interactive discussions |
| `spec-05-gmetrix-csv-and-push` | Unregistered CSV rows are returned for manual email/MS Teams delivery (no automated email send) | Phase 2 when Resend transactional email notifications are added |
| `spec-06b-guest-passes` | Guests get event-scoped passes only (no accounts, no post-event evaluation forms, no org membership) | Phase 2 if guest feedback is required (emailed evaluation link tied to the pass) |
| `spec-06b-guest-passes` | Rate limiting uses a Postgres counter table | When public registration traffic makes DB writes a bottleneck (move to edge KV) |
| `spec-06b-guest-passes` | Public guest routes share the `web-admin/` Cloudflare Pages origin | If public traffic grows or CSP needs diverge (split into `web-public/`) |
| `spec-06b-guest-passes` | Guest PII retention fixed at 30 days after event end | Once the DPO confirms the official retention period |
| `spec-06b-guest-passes` | Kiosk and officer walk-ins are not email-verified (tagged by `source`) | If walk-in abuse appears in reports (add email confirmation before pass) |
| `spec-07-conditional-forms-metrics` | Form builder capped at 4 field types + 1-level `visibleIf` equality (no AND/OR trees or file uploads) | Phase 2 if complex multi-branch evaluations are required |
