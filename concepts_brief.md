# MyCCS Documentation Synchronization & Architecture Re-Baseline (`docs/jira`)

* **Author:** Alexis John Rellon
* **Date:** 2026-11-22

## Overview

The four planning documents in `docs/jira` (`Software_Architecture_Baseline.md`, `College Department App - Agile Project Brief_Proposal.md`, `CI_CD Pipeline Specification_ Centralized Department Mobile App.md`, and `Git Branching & Version Control Strategy.md`) currently contradict each other and describe a different product than what the team intends to build.

This brief reconciles all four specifications around the real MyCCS product scope, anchored on `Software_Architecture_Baseline.md` (`SCRUM-9`), so the 5-person team (1 PM/PO, 2 developers, 1 QA/DevOps, 1 UI/UX) has one consistent baseline before implementation.

Confirmed product scope:
* **Students (Expo React Native mobile app):** View department information ("About"), browse and join Main Organizations and Sub-Organizations, view events (onsite with permanent QR ticket or online with meeting links), submit membership applications and post-event evaluations, view listed certifications, and receive GMetrix certification access keys via in-app view and push notifications.
* **Organizations and Sub-Organizations (mobile app):** Operate as a two-tier hierarchy (College Department -> Main Student Org -> Sub-Orgs as separate entities). Customize a simplified Facebook-Page-style profile (cover image, logo, details, chronological posts), create conditional membership applications and post-event evaluation forms, host onsite or online events, scan student QR codes offline for check-in/check-out, and view evaluation metrics.
* **Faculty / Admins (separate Web Admin directory):** Operate under the `admin` role in a dedicated monorepo directory (e.g., `web-admin/`) deployed independently on the cloud hosting provider (never bundled into the mobile app). Upload CSV files mapping institutional emails to GMetrix keys; registered students receive content-free push + in-app notifications, while unregistered rows are flagged back to the professor for manual email or MS Teams delivery.

## Analysis

### 1. Critical Architectural & Operational Risks

* **Offline Timestamp vs. Server Authority (`SAB §25.6`):** `SAB` states that the server timestamp is authoritative and attendance is append-only. If an officer scans students offline at 8:05 AM and syncs at 11:00 AM, using server `NOW()` marks everyone absent. Supporting both check-in and check-out (plus automatic checkout after a configured window) also requires separating raw scans from final attendance records.
  * *Resolution:* Separate immutable `attendance_scans` (append-only, keyed by `client_scan_id` UUID for idempotency) from materialized `attendance_records` (`checked_in_at`, `checked_out_at`, `checkout_source`: `'scan' | 'auto'`, computed status). Capture `clock_offset_ms = server_now - device_now` when the officer opens the event online, store both `adjusted_scanned_at` and `synced_at`, and flag large clock skew for audit. Reconcile multi-officer offline scans server-side (earliest valid check-in wins; duplicate scans within cooldown are ignored; officer rescan after cooldown sets check-out; a scheduled job or server rule applies auto-checkout after the organizer-configured period if no scan-out occurred).
* **Permanent Personal QR Proxy & Privacy Risks (RA 10173):** Using a student's permanent personal QR solves offline validation, but introduces screenshot sharing (proxy attendance) and PII exposure if raw student data is encoded in the QR.
  * *Resolution:* Encode an opaque signed token (`v1.<profile_id>.<short_hmac>`) rather than raw name, email, or `student_id` (keeping `student_id` private). Pre-sync a minimal display roster to the officer's local SQLite so the scanner displays the student's full name on scan for visual verification. Accept scans of newly registered uncached students optimistically and resolve them on sync.
* **PII Encryption & Key Rotation vs. CSV Email Matching (`SAB §28`, `ADR-008`):** The author confirmed that security is a top priority: PII encryption and periodic key rotation remain in scope. However, randomized ciphertext breaks SQL `WHERE email = ?` lookups needed when matching GMetrix CSV uploads by institutional email.
  * *Resolution:* Encrypt PII columns (`student_id`, `full_name`, `email`, and `certification_keys.key_code`) using authenticated encryption via Supabase Vault / backend Edge Functions with a `key_version` column on encrypted tables to support zero-downtime 90-day / 30-day key rotation. Store a deterministic keyed **blind index** (`email_blind_index = HMAC-SHA256(lowercase(email), blind_index_key)`) alongside `email_ciphertext` so CSV uploads can match registered students in O(1) without decrypting the table.
* **Image Compression Pipeline:** Keeping server-side image compression (`POST /functions/v1/compress-image`) alongside client-side pre-compression (`expo-image-manipulator`) enforces EXIF stripping, WebP normalization, and file-size caps on the backend before writing to Supabase Storage. Keep input payload limits strict (e.g., max 5 MB pre-compressed) so Deno Edge Functions do not hit memory limits.
* **Scope & Schedule Risk (2 Developers / 4 Sprints):** Keeping a separate `web-admin/` app, conditional form builder, image compression Edge Function, and PII encryption with key rotation makes the 4-sprint timeline tight for two developers. Strict MVP boundaries (4 form field types + 1-level `visibleIf` branching, read-only org pages with no social comments/likes, and shared TypeScript/Zod types in `packages/shared/`) are required to prevent schedule overrun.
* **GMetrix CSV Edge Cases:** Push notifications must never contain raw keys (deep link only; student fetches key in-app under RLS `student_id = auth.uid()`). CSV uploads use partial-commit processing: commit valid registered rows idempotently (`UNIQUE(key_code)`) and return a downloadable rejected-rows CSV (sanitized against spreadsheet formula prefixes `=`, `+`, `-`, `@`) for manual email/MS Teams distribution.

### 2. Live Codebase & Governance Misalignment

* **Greenfield Repo vs. Docs:** `package.json` currently contains only base Expo/React Native, TypeScript, Jest, and Husky. None of `expo-router`, `zustand`, `zod`, `expo-sqlite`, `@supabase/supabase-js`, `expo-camera`, `expo-notifications`, or `web-admin/` exist yet.
* **Pre-Merge Deploy Bug in `.github/workflows/ci.yml`:** The workflow triggers only on `pull_request` (`main`, `develop`), yet `Phase 5 · Deploy` runs whenever `github.base_ref == 'main'`. Opening a PR to `main` would trigger production deployment before merge. Move CD to `on: push` for `main`/`develop`, add `Phase 1` (Jira ID check), and include `Phase 3 · Playwright E2E Tests` in `scripts/branch-protection-body.json`.
* **Commit Hook Mismatch (`.husky/commit-msg`):** The regex requires `(scope)`, rejecting scope-less commits allowed by `Git Branching Strategy §4` and bare `SCRUM-12 ...` commits allowed by `git-hygiene.md`. Its examples also cite `CCS-42` instead of `SCRUM-42`.
* **Supabase Config Defaults (`supabase/config.toml`):** `[auth.email] enable_signup = true` contradicts Institutional SSO Only, no OAuth provider is enabled yet, and `supabase/migrations/` and `supabase/functions/` do not exist. Because `auto_expose_new_tables` is unset, every migration creating `public` tables must include explicit `GRANT` statements for `authenticated` alongside RLS policies.
* **Cross-Doc Drift & Stale PDF:** Jira keys vary across `DEPT-123`, `SCRUM-*`, and `CCS-42`; branch rules conflict (`release` vs. `develop`; `feature/*` vs. `feat/SCRUM-*`); project titles differ; `CI/CD` has placeholder sign-offs (`Person`); and `Software_Architecture_Baseline.pdf` is a binary export that goes stale on every edit.

### 3. Inventive Contradictions & Ideal Final Result (IFR) Transforms

1. **Encrypted Email PII vs. Fast GMetrix CSV Matching:**
   * *Contradiction:* Institutional emails must be encrypted at rest with periodic key rotation, yet CSV uploads must look up hundreds of students by email quickly.
   * *Transform (Intermediary / Keyed Blind Index):* Store `email_ciphertext` + `key_version` alongside an indexed `email_blind_index` (HMAC-SHA256). Lookups stay fast without exposing plaintext emails in the database.
2. **Separate Web Admin Bundle vs. 2-Dev Maintenance Overhead:**
   * *Contradiction:* Web Admin must live in its own directory and never bundle into the mobile app, yet duplicating Zod schemas and Supabase types slows down two developers.
   * *Transform (Segmentation):* Isolate `web-admin/` as a standalone deployable directory (configured via root directory in Vercel/Netlify) while sharing validation schemas and DB types via a lightweight `shared/` folder.
3. **Conditional Form Builder + Host Metrics vs. 4-Sprint Timeline:**
   * *Contradiction:* Orgs need conditional forms and evaluation metrics without building a full survey/BI platform.
   * *Transform (Parameter Change):* Store forms as a Zod-validated JSONB array with 4 MVP field types (`short_text`, `single_choice`, `multi_choice`, `rating_1_5`) and 1-level `visibleIf: { fieldId, equals }`; aggregate metrics via a PostgreSQL RPC/view.
4. **Offline Scanning vs. Accurate Windows, Check-Out & Anti-Proxy:**
   * *Contradiction:* Officers scan with zero connectivity while enforcing on-time/late/absent windows, cooldowns, check-out, and proxy deterrence.
   * *Transform (Prior Action + Self-Service):* Cache `clock_offset_ms`, event window/cooldown config, and display names into SQLite before going offline; use officer rescan for check-out plus server-side auto-checkout after the configured timeout.

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Enforce Single Source of Truth (SSOT) boundaries across all four `docs/jira` documents and eliminate cross-doc contradictions.
  * Align `Software_Architecture_Baseline.md` (`SCRUM-9`) and a new `PRD_MyCCS.md` with the confirmed product scope: Expo Mobile App, separate `web-admin/` portal, 3-role RBAC (`student | officer | admin` with faculty under `admin`), Department About, two-tier Main Org -> Sub-Org simplified pages, online/onsite events, offline-first officer-scanned permanent QR check-in/check-out (with cooldown and auto-checkout), bounded conditional form builder + host evaluation metrics, GMetrix CSV key distribution matched by institutional email (keeping `student_id` private), content-free push + in-app notifications, image compression on upload, and PII encryption with key rotation.
  * Align `.github/workflows/ci.yml`, `scripts/branch-protection-body.json`, `.husky/commit-msg`, and `supabase/config.toml` with the reconciled specifications.
* **Out-of-Scope Non-Goals:**
  * Email notification delivery for GMetrix keys (deferred to Phase 2; faculty handle unregistered students manually via email/MS Teams).
  * Free-form drag-and-drop page builders, social features (likes, comments, student-to-student messaging), multi-condition AND/OR form logic trees, file-upload form fields, payment processing, and multi-college deployment.

## Alternatives Weighed

* **Student-scanned rotating event QR (`SAB §24`, `ADR-006`) vs. Officer-scanned permanent personal QR:** Rejected rotating QR by author because campus venues lack reliable internet; officer-scanned permanent personal QR with SQLite queuing was selected.
* **Student-scanned static event QR (`Agile Brief §2.4`):** Rejected because static venue QR codes allow remote sharing and direct client `PATCH` calls bypass server authorization.
* **Expo Router Web (`app/(admin)/*`) vs. Separate `web-admin/` directory:** Rejected Expo Router Web by author so Web Admin is never bundled into the mobile app and can be selected as a standalone directory on the cloud hosting provider.
* **Dedicated `faculty` RBAC role vs. Faculty under `admin`:** Rejected separate `faculty` role by author; faculty operate under the `admin` role.
* **Match GMetrix CSV by `student_id` vs. Institutional `email`:** Rejected `student_id` matching by author to keep `student_id` private; institutional email (SSO-verified) is the matching key.
* **Hold GMetrix keys as "pending" for unregistered students vs. Reject & notify professor:** Rejected pending holding by author; unregistered rows are rejected with a prompt for manual email/MS Teams delivery.
* **Drop PII encryption / image compression Edge Function for MVP speed vs. Keep both:** Rejected dropping them by author because security (PII encryption + key rotation) and upload image compression are non-negotiable priorities.

## Key Decisions & Staging for Next Steps

1. **Web Admin:** Dedicated `web-admin/` directory in the monorepo, deployed independently via cloud provider root-directory selection, never bundled in the Expo mobile app.
2. **RBAC:** 3 roles (`student | officer | admin`), with faculty operating under `admin`.
3. **GMetrix CSV & Privacy:** Match by institutional email using a keyed blind index over encrypted PII (`key_version` rotation); keep `student_id` private; reject unregistered rows for manual email/MS Teams distribution; send content-free push + in-app notifications to registered students.
4. **Attendance & Check-Out:** Officer scans student's opaque permanent QR offline into SQLite; check-in classified by organizer-configured on-time/late/absent windows; officer rescan after cooldown records check-out, with configurable auto-checkout timeout if the student forgets to scan out.
5. **Security & Media:** Keep PII encryption with periodic key rotation (`key_version` + blind index) and keep image compression on upload to Supabase Storage.
6. **Next Deliverable:** Generate `docs/jira/PRD_MyCCS.md` from this finalized brief, then reconcile the four existing `docs/jira` documents against it.
