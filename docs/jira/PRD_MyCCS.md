# Product Requirements Document (PRD): MyCCS

* **Document Type:** Product Requirements Document (PRD)
* **Project:** MyCCS (Centralized College of Computing Studies Platform)
* **Author:** Alexis John Rellon
* **Version:** 1.1.0
* **Status:** Draft for Review
* **Date:** 2026-11-25
* **Change Log:**
  * **1.1.0 (2026-11-25):** Added guest participation for open events (`FR-GUEST`, approved change `spec-06b-guest-passes`): event audience setting, guest passes, kiosk and officer walk-ins, guest data retention.
  * **1.0.0 (2026-11-22):** Initial draft.
* **Related Specifications:**
  * [Software Architecture Baseline (`SCRUM-9`)](./Software_Architecture_Baseline.md)
  * [Agile Project Brief](./College%20Department%20App%20-%20Agile%20Project%20Brief_Proposal.md)
  * [CI/CD Pipeline Specification](./CI_CD%20Pipeline%20Specification_%20Centralized%20Department%20Mobile%20App.md)
  * [Git Branching & Version Control Strategy](./Git%20Branching%20%26%20Version%20Control%20Strategy.md)

---

## 1. Executive Summary

MyCCS is a centralized platform for the College of Computing Studies (CCS) serving students, student organizations (Main Organizations and Sub-Organizations), and faculty administrators. It replaces fragmented social media announcements, manual attendance sheets, ad-hoc Google Forms, and manual spreadsheet-based certification key distribution with two coordinated applications backed by Supabase:

1. **MyCCS Mobile App (Expo React Native, TypeScript):** Primary client for Students and Organization Officers.
2. **MyCCS Web Admin Portal (`web-admin/`, standalone Vite + React SPA):** Dedicated desktop browser portal for Faculty/Admins, deployed independently to **Cloudflare Pages** via directory selection (zero backend secrets on Cloudflare) and excluded from the mobile app bundle.

---

## 2. Goals & Success Metrics

### 2.1 Product Goals
* Centralize CCS department information, organization pages, announcements, events, and certification listings into one mobile hub.
* Support a two-tier organization hierarchy (College Department -> Main Org -> Sub-Orgs) with self-service simplified pages, conditional membership applications, and post-event evaluation metrics.
* Enable reliable onsite event attendance in zero-connectivity campus venues via offline-first officer QR scanning with automatic check-in/check-out classification.
* Let participants from other colleges or schools attend open (university-wide or inter-college) events using event-scoped guest passes, without giving them MyCCS accounts.
* Automate secure distribution of GMetrix certification access keys from faculty CSV uploads to registered students via in-app and push notifications, while clearly flagging unregistered students for manual fallback.
* Protect all student PII and certification keys under Republic Act No. 10173 (Data Privacy Act of 2012) using application/backend encryption, periodic key rotation, and strict PostgreSQL Row Level Security (RLS).

### 2.2 Success Metrics (MVP)
* **Onboarding:** 80% of recognized CCS organizations and sub-organizations publish active pages within 2 weeks of launch.
* **Offline Attendance Reliability:** 100% of offline-queued officer scans sync to Supabase without data loss once connectivity returns; local scan feedback renders in `< 200ms`.
* **GMetrix Distribution:** Faculty can upload a CSV of up to 500 students and receive a processed summary (delivered count + downloadable unregistered-student fallback CSV) in `< 10 seconds`.
* **Security Compliance:** Zero plaintext PII (`student_id`, `email`, `full_name`) or raw GMetrix keys exposed in QR payloads, push notification payloads, or client logs.

---

## 3. User Roles & Permissions (RBAC)

The MVP uses three primary roles enforced at the database layer (PostgreSQL RLS + JWT claims) and Edge Functions:

| Role | Who | Core Capabilities |
| :--- | :--- | :--- |
| **`student`** | Enrolled CCS students (default role after verified `@lpunetwork.edu.ph` OTP signup) | View Department About, browse/join Main Orgs & Sub-Orgs, submit membership applications, view/register for onsite & online events, display permanent personal QR ticket, submit post-event evaluation forms, view certification directory, view own GMetrix access keys and notifications. |
| **`officer`** | Assigned officers of a Main Org or Sub-Org (scoped via `org_memberships`) | All `student` capabilities, plus: customize assigned org/sub-org page (cover, logo, details), publish org posts/announcements, build conditional membership application forms and review applicants, create onsite/online events, run offline QR attendance scanner (check-in/check-out), build conditional post-event evaluation forms, and view evaluation metrics for their org's events. |
| **`admin`** | College Department Faculty & Administrators | Global governance: manage Department About content, create/manage Main Orgs and assign officers, publish department-wide announcements, manage Certification Directory listings, and upload GMetrix CSV key batches via the Web Admin portal. |

### Guests (Non-Member Participants)
Guests are participants from other colleges or schools who attend events whose audience is `open`. They are **not** an RBAC role and have **no MyCCS account**: they exist only as `event_guests` rows scoped to one event and are identified by an event-scoped guest pass (see `FR-GUEST`). Guests cannot join orgs, view certification keys, or submit evaluation forms in the MVP.

### Organization Hierarchy Rules
* **College Department (CCS)** -> owns **Main Organizations** (College Student Orgs).
* **Main Organization** -> owns **Sub-Organizations** (`organizations.parent_org_id` references Main Org).
* Sub-Organizations operate as separate entities with their own pages, posts, membership applications, officers, and events under their parent Main Organization.

---

## 4. Functional Requirements

### 4.1 Authentication & Privacy-First Identity (`FR-AUTH`)
* **FR-AUTH-01 (Verified Institutional Email Auth):** Because direct University Microsoft 365 IdP (Entra ID) clearance is unavailable, authentication uses Supabase **Email + Password** with **mandatory 6-digit OTP email verification** on signup (`enable_signup = true`, `enable_confirmations = true`) delivered via **Resend** custom SMTP. A server-side Supabase `before-user-created` Auth Hook strictly restricts signups to `@lpunetwork.edu.ph` (never client-only regex).
* **FR-AUTH-02 (First-Login Provisioning & Admin Bootstrapping):** Upon verified signup, the backend creates a `profiles` record with default role `student` and generates a permanent opaque signed QR token (`v1.<profile_id>.<short_hmac>`). Initial Department Admin(s) are seeded via SQL, and existing `admin` users can promote verified `@lpunetwork.edu.ph` faculty accounts to `admin` inside `web-admin/`.
* **FR-AUTH-03:** `student_id` is kept private and never exposed publicly or used as a CSV matching key. Verified institutional `email` (`@lpunetwork.edu.ph`) is the authoritative matching key for faculty CSV imports.

### 4.2 Department About & Announcements (`FR-DEPT`)
* **FR-DEPT-01:** Students can view a dedicated **About the Department** section containing CCS overview, mission/vision, leadership/faculty directory, and contact details managed by `admin`.
* **FR-DEPT-02:** Students see a centralized feed of department-wide announcements and announcements from organizations/sub-organizations they belong to, with optional expiration timestamps (`expires_at`).

### 4.3 Organizations & Sub-Organizations (`FR-ORG`)
* **FR-ORG-01:** Students can browse all Main Orgs and their nested Sub-Orgs, view org pages, and apply to join multiple orgs/sub-orgs.
* **FR-ORG-02 (Simplified Org Page):** Each org/sub-org officer can customize a simplified Facebook-Page-style profile containing:
  * Cover image (compressed on upload)
  * Profile logo (compressed on upload)
  * Organization details/bio
  * Chronological posts/announcements (read-only for students in MVP; no likes or comments).
* **FR-ORG-03 (Membership Applications):** Officers can attach a custom conditional form (see `FR-FORM`) to their org's membership application and approve or reject pending applications (`pending | approved | rejected`).

### 4.4 Events — Onsite & Online (`FR-EVT`)
* **FR-EVT-01:** Officers and Admins can create events with modality `onsite` or `online`, title, description, compressed flyer banner, optional capacity limit, lifecycle status (`draft | published | ongoing | completed | archived`), and audience (`ccs_only` by default, or `open` to allow guests; see `FR-GUEST-01`).
* **FR-EVT-02 (Online Events):** Online events store a validated meeting link (e.g., Zoom, Google Meet, MS Teams) visible to registered students.
* **FR-EVT-03 (Onsite Events):** Onsite events support QR attendance with organizer-configured attendance rules:
  * Event start/end times
  * On-time grace window (e.g., `8:00–8:15 AM` -> `present`)
  * Late window (e.g., `+5 minutes` after grace window -> `late`; beyond -> `absent`)
  * Scan cooldown period (prevents accidental double-scans)
  * Auto-checkout duration (automatically records checkout if a student forgets to scan out within the set period).

### 4.5 Offline-First QR Attendance (`FR-ATT`)
* **FR-ATT-01 (Permanent Personal QR):** Every student has a permanent personal QR code in the mobile app encoding an opaque signed token (no raw PII).
* **FR-ATT-02 (Offline Officer Scanning):** Officers can open an onsite event's scanner with zero internet connectivity. Scans write immediately to local SQLite (`attendance_scans` queue) with an idempotent `client_scan_id` UUID and sync automatically to Supabase when connectivity returns.
* **FR-ATT-03 (Clock Offset & Window Classification):** When an officer opens an event while online, the app caches the event's attendance window rules, cooldown duration, a minimal display roster (student names for visual verification), and `clock_offset_ms = server_now - device_now`. Offline scans stamp `adjusted_scanned_at = device_now + clock_offset_ms` so the scanner and server classify `present`, `late`, or `absent` accurately even when synced hours later.
* **FR-ATT-04 (Check-In, Check-Out & Auto-Checkout):**
  * First valid scan records `checked_in_at` and computes attendance status (`present | late | absent`).
  * Any repeat scan within the organizer's cooldown window is ignored with clear on-screen feedback.
  * A subsequent officer scan after the cooldown window flags `checked_out_at` (`checkout_source = 'scan'`).
  * If a checked-in student does not scan out before the organizer's configured auto-checkout time period elapses, the backend automatically sets `checked_out_at` (`checkout_source = 'auto'`).
* **FR-ATT-05 (Multi-Officer Reconciliation):** If multiple officers scan offline at separate doors, server sync reconciles idempotently (earliest valid check-in wins; duplicate scans inside cooldown are dropped; latest valid check-out wins).
* **FR-ATT-06 (Guest Passes at the Door):** For `open` events, the scanner also accepts guest passes (`g1.` prefix) and applies the same classification, cooldown, check-out and auto-checkout rules as member QR IDs (`v1.`). Each `attendance_records` row references exactly one of `profile_id` or `guest_id`. Details in `FR-GUEST-05`.

### 4.6 Conditional Form Builder & Post-Event Evaluation Metrics (`FR-FORM`)
* **FR-FORM-01 (Form Builder):** Officers can create custom forms for (a) org membership applications and (b) post-event student evaluations using a Zod-validated JSONB schema supporting:
  * 4 MVP field types: `short_text`, `single_choice`, `multi_choice`, `rating_1_5`
  * Required/optional toggle per field
  * Single-level conditional visibility rules (`visibleIf: { fieldId, equals }`) to show or hide dependent inputs dynamically.
* **FR-FORM-02 (Post-Event Submission):** Students who attended an event can submit its post-event evaluation form once (`UNIQUE(form_id, student_id)`).
* **FR-FORM-03 (Host Evaluation Metrics):** Event hosts/officers can view aggregated evaluation metrics per event (total responses, average score per `rating_1_5` question, option distribution counts/percentages per `single_choice`/`multi_choice` question, and text responses) computed via a PostgreSQL view/RPC.

### 4.7 Certification Directory & Web Admin GMetrix Key Distribution (`FR-CERT`)
* **FR-CERT-01 (Certification Directory):** Students can browse institution-offered certifications (e.g., CompTIA, Cisco, SAP, Certiport) and view any GMetrix access keys assigned to them inside an authenticated "My Keys" view.
* **FR-CERT-02 (Web Admin CSV Upload):** Faculty (`admin` role) log into the standalone Web Admin portal (`web-admin/`) and upload a CSV containing institutional email and GMetrix key columns (selected per certification program).
* **FR-CERT-03 (Partial-Commit Processing & Matching):** A trusted Supabase Edge Function (`import-gmetrix-keys`) parses and validates the CSV:
  * Matches rows to registered students via institutional email blind index.
  * Commits valid rows idempotently (`UNIQUE(key_code)`), encrypting `key_code` before storage.
  * Rejects rows for unregistered students (no app profile) or duplicate/malformed rows without rolling back valid rows.
* **FR-CERT-04 (Unregistered Student Fallback):** After upload, the Web Admin UI displays a summary (assigned count, rejected count) and prompts the professor to distribute rejected keys via alternate channels (e.g., direct email or MS Teams), offering a downloadable CSV of rejected rows (sanitized against spreadsheet formula injection `=`, `+`, `-`, `@`).
* **FR-CERT-05 (In-App & Push Notifications):** For each successfully assigned key, the backend creates an in-app notification record and triggers an Expo Push Notification alerting the student that their GMetrix key is available. **The push payload must never contain the raw key**—only a deep link to the authenticated in-app screen. (Email notifications are deferred to Phase 2.)

### 4.8 Guest Participation for Open Events (`FR-GUEST`)
Source: approved OpenSpec change `spec-06b-guest-passes`.

* **FR-GUEST-01 (Event Audience):** Each event has `audience = ccs_only | open` (default `ccs_only`). Only officers of the host org or admins can change it. Guest registration, kiosk links and guest scans are rejected for `ccs_only` events.
* **FR-GUEST-02 (Pre-Registration):** Each `open` event has a public registration page (`/e/:eventId`, served by the `web-admin/` Cloudflare Pages app outside the admin route guard). It collects full name, email, affiliation (college/school) and RA 10173 consent; validates server-side with the shared Zod schema and Cloudflare Turnstile; allows one registration per email per event (blind index); counts guests toward event capacity; and closes when the event ends. Duplicate and member emails receive the same generic "Check your email" response.
* **FR-GUEST-03 (Guest Pass):** A guest pass is an event-scoped QR `g1.<guest_id>.<short_hmac>`. The HMAC covers the guest id and event id and uses `GUEST_PASS_HMAC_KEY`, which is separate from the member QR key and never shipped to devices. Passes contain no PII and are emailed via Resend. Guests can request a rate-limited resend.
* **FR-GUEST-04 (Walk-Ins):**
  * **Kiosk:** An officer of the host org (or an admin) creates a kiosk link locked to one `open` event. The link is stored hashed, expires at event end, and is revocable. The entrance laptop opens `/e/:eventId/kiosk`; the walk-in types their details, the pass QR is shown on screen, and the form resets after 20 seconds. **No one logs in on the kiosk device; shared admin/organizer accounts are not used.**
  * **Officer phone:** "Add walk-in" on the scanner records the guest and an immediate check-in, works offline (client UUID, idempotent sync), and flags `over_capacity` instead of dropping data.
* **FR-GUEST-05 (Scanning Guests):** Offline, a guest pass is accepted if its `guest_id` is in the cached guest roster. A well-formed pass not in the cache is queued as an "unverified guest" scan; the server verifies HMAC and event match on sync and rejects failures into a "Rejected scans" list. Guest passes are refused at `ccs_only` events.
* **FR-GUEST-06 (Guest Data Protection & Retention):** Guest name and email are encrypted with `key_version` plus an email blind index. Only host-org officers and admins can read guest rows; `anon` has no table privileges (public writes go through Edge Functions). A daily job purges guest name, email and blind index `GUEST_RETENTION_DAYS` after the event ends (default 30, pending DPO confirmation), keeping rows for counts.
* **FR-GUEST-07 (Metrics Split):** Host attendance summaries report member and guest counts on separate lines, with guests broken down by source (pre-registered, kiosk, officer walk-in).

---

## 5. Non-Functional Requirements

### 5.1 Security & Data Privacy (RA 10173)
* **PII Encryption & Key Rotation:** All sensitive PII (`email`, `full_name`, `student_id`) and `certification_keys.key_code` are encrypted via backend Edge Functions / Supabase Vault with a `key_version` column supporting periodic key rotation (90-day standard, 30-day critical secrets). A keyed HMAC-SHA256 `email_blind_index` enables exact-match lookups for CSV imports without decrypting the table.
* **Authorization:** Row Level Security (RLS) is enabled on every `public` table with explicit `GRANT` statements for `authenticated`. Client applications are never trusted to set roles or bypass ownership checks.
* **Guest Data:** Guest PII follows the same encryption and blind-index scheme as member PII, is collected only with recorded consent (`consent_version`, `consent_at`), and is purged after the retention period (`FR-GUEST-06`). Public guest endpoints are protected by Turnstile and rate limits.
* **Media Upload Compression & Privacy:** Uploaded cover images, logos, and event flyers are pre-compressed on-device and processed through `POST /functions/v1/compress-image` (strict JWT + role verification, EXIF metadata stripping, WebP conversion, size/MIME limits) before writing to Supabase Storage.

### 5.2 Architecture & Deployment Separation
* **Mobile App:** Root Expo React Native workspace built via Expo EAS.
* **Web Admin Portal:** Isolated Vite + React + TypeScript SPA in `web-admin/` within the monorepo, deployed independently to **Cloudflare Pages** (root directory `web-admin/`, zero backend secrets on Cloudflare, strict Edge Function CORS allowlist), and strictly excluded from mobile Metro/EAS bundles. Shared Zod schemas and TypeScript contracts live in `shared/`. Public guest routes (`/e/:eventId`, `/e/:eventId/kiosk`) are lazy-loaded chunks in the same app, outside the admin route guard, and must not import admin modules.
* **CI/CD & Git Hygiene:** All branches and commits follow `SCRUM-XXXX` conventions targeting `develop` (integration/staging) and `main` (production). Production deploys run strictly on post-merge `push` events, never on open `pull_request` events.

---

## 6. Out of Scope (MVP)

* Automated email notifications for GMetrix key distribution (Phase 2).
* Free-form drag-and-drop org page builders; social engagement features (likes, comments, student-to-student chat).
* Complex multi-condition AND/OR form branching trees or file-upload fields in the form builder.
* Third-party live certification APIs (Cisco/SAP/GMetrix APIs) and payment processing.
* Multi-college / multi-campus expansion (MyCCS accounts remain CCS-only; non-CCS participants attend open events as guests per `FR-GUEST`).
* Guest accounts, guest post-event evaluation forms, guest org membership, and certificates of attendance.

---

## 7. High-Level Data Entities (Summary)

Full column definitions, constraints, and RLS policies are maintained in [Software Architecture Baseline (`SCRUM-9`)](./Software_Architecture_Baseline.md):

* `profiles` (encrypted PII + `email_blind_index` + `key_version` + `qr_token` + `role`)
* `department_info` (CCS "About" content)
* `organizations` (`parent_org_id` for Sub-Orgs, `cover_url`, `logo_url`, `details`)
* `org_memberships` (`profile_id`, `organization_id`, `role`, `status`)
* `announcements` (org/sub-org posts and department-wide notices)
* `events` (`modality`, `meeting_url`, `flyer_url`, `capacity`, `on_time_grace_mins`, `late_window_mins`, `cooldown_secs`, `auto_checkout_mins`, `status`, `audience`)
* `event_registrations`
* `event_guests` (encrypted name/email + blind index, `affiliation`, `source`, consent fields, `over_capacity`, `purged_at`) & `event_kiosk_links` (hashed token, `expires_at`, `revoked_at`)
* `attendance_scans` (append-only raw offline/online scans keyed by `client_scan_id`) & `attendance_records` (`profile_id` **or** `guest_id`, `checked_in_at`, `checked_out_at`, `checkout_source`, `status`)
* `forms` (JSONB conditional schema) & `form_submissions`
* `certifications`, `certification_key_batches`, & `certification_keys` (encrypted `key_code`)
* `notifications` & `push_tokens`

---

## 8. Phased Delivery Alignment (4 Sprints)

* **Sprint 1 — Foundation & Security:** Verified `@lpunetwork.edu.ph` Email + Password + 6-digit OTP Auth (server-side domain hook + Resend SMTP), SQL-seeded admin bootstrapping, encrypted `profiles` + blind index + key rotation foundation, `department_info`, `organizations` (Main + Sub-Org), RLS + `GRANT` migrations, CI/CD fix (post-merge deploy), and `web-admin/` Vite SPA scaffold on Cloudflare Pages.
* **Sprint 2 — Org Hub & GMetrix Distribution:** Simplified org/sub-org pages + image compression upload pipeline, announcements feed, Certification Directory, Web Admin GMetrix CSV upload (`import-gmetrix-keys`), rejected-row CSV fallback, and content-free Expo Push + in-app notifications.
* **Sprint 3 — Events, Offline Attendance & Conditional Forms:** Onsite/online events, offline SQLite officer QR scanner (`clock_offset_ms`, cooldown, check-in/check-out + auto-checkout), conditional form builder (membership applications + post-event evaluations), host evaluation metrics RPC, and guest passes for open events (audience setting, public pre-registration, kiosk/officer walk-ins, guest scanning, retention purge).
* **Sprint 4 — Hardening, QA & Release:** Jest unit tests, Newman API contract tests, Playwright E2E tests for `web-admin/`, offline/reconnect field testing, security audit (CodeQL/Snyk/RA 10173), and EAS + Web Admin production cutover.
