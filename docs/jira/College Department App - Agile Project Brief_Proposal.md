# Project Brief: MyCCS (Centralized College of Information Technology and Computer Science Platform)

* **Type:** Agile Project Brief / Product Scope Proposal
* **Prepared By:** Alexis John L. Rellon
* **Status:** Updated — Aligned with PRD & SAB
* **Last Updated:** 2026-11-22
* **Related Specifications:**
  * [Product Requirements Document (`PRD_MyCCS.md`)](./PRD_MyCCS.md)
  * [Software Architecture Baseline (`SCRUM-9`)](./Software_Architecture_Baseline.md)
  * [CI/CD Pipeline Specification](./CI_CD%20Pipeline%20Specification_%20Centralized%20Department%20Mobile%20App.md)
  * [Git Branching & Version Control Strategy](./Git%20Branching%20%26%20Version%20Control%20Strategy.md)

---

## 1. Executive Summary

MyCCS is a centralized platform for the College of Information Technology and Computer Science (CCS)—offering Information Technology (IT), Computer Science (CS), and Library and Information Science (LIS)—serving students, student organizations (Main Organizations and Sub-Organizations), and faculty administrators. Built under an Agile Scrum methodology, the MVP unifies department information, organization pages, event registration, offline-first QR attendance, conditional forms/evaluations, and faculty-driven GMetrix certification key distribution.

The platform consists of two coordinated applications backed by Supabase:
* **MyCCS Mobile App (Expo React Native, TypeScript):** Primary client for Students and Organization Officers.
* **MyCCS Web Admin Portal (`web-admin/`):** Standalone web application for Faculty/Admins (deployed independently via cloud hosting directory selection and excluded from the mobile bundle).

---

## 2. The MVP Scope: First Agile Release

Detailed functional specifications live in [PRD_MyCCS.md](./PRD_MyCCS.md). Technical architecture, database schema, and Edge Function contracts live in [Software_Architecture_Baseline.md](./Software_Architecture_Baseline.md).

### 2.1. Unified Authentication & Privacy
* **Verified Institutional Email Auth (`@lpunetwork.edu.ph`):** Because direct MS 365 IdP clearance is unavailable, signup uses Email + Password with mandatory 6-digit OTP verification delivered via Resend SMTP and enforced by a server-side `@lpunetwork.edu.ph` Auth Hook. Initial admins are seeded via SQL and can promote verified faculty in `web-admin/`.
* **Privacy & Security (RA 10173):** Student PII (`email`, `full_name`, `student_id`) and GMetrix keys are encrypted at rest with periodic key rotation (`key_version`). `student_id` is kept private; verified institutional `email` (matched via a keyed blind index) is used for faculty CSV imports.

### 2.2. Department Info & Centralized Announcements (RBAC)
* **About the Department:** Dedicated CCS overview, mission/vision, leadership/faculty directory, and contact information managed by `admin`.
* **3-Role Hierarchy:**
  * **`admin` (Faculty & Department Admins):** Global oversight, Department About management, Main Org governance, Certification Directory management, and Web Admin GMetrix CSV key distribution.
  * **`officer` (Org & Sub-Org Officers):** Scoped content creation, org page customization, membership applications, event hosting, offline QR scanning, and evaluation metrics.
  * **`student`:** Browse Department About, join orgs/sub-orgs, register for events, present personal QR ticket, submit evaluations, view certifications, and access assigned GMetrix keys.

### 2.3. Organizations & Sub-Organizations
* **Two-Tier Hierarchy:** College Department -> Main Organization (College Student Org) -> Sub-Organizations (separate entities under Main Org).
* **Simplified Org Pages:** Facebook-Page-style profile with compressed cover image, compressed logo, org details, and chronological posts.
* **Conditional Membership Applications:** Officers build custom conditional application forms and approve/reject student applications.

### 2.4. Events, Offline-First QR Attendance & Post-Event Evaluations
* **Onsite & Online Events:** Online events provide validated meeting links (Zoom, Google Meet, MS Teams); onsite events use QR attendance.
* **Offline-First Officer Scanning:** Students present a permanent personal QR code (opaque signed token; no raw PII). Officers scan students even with zero internet connectivity into a local SQLite queue that syncs automatically to Supabase when online.
* **Check-In, Check-Out & Windows:** Organizer-configured on-time/late/absent time windows, scan cooldown guards, officer rescan for check-out, and an automatic check-out timeout if a student forgets to scan out.
* **Post-Event Evaluation Forms & Metrics:** Officers create conditional post-event evaluation forms (4 MVP field types + single-level conditional visibility) and view aggregated host metrics.

### 2.5. Certification Directory & Web Admin GMetrix Key Distribution
* **Certification Directory:** Students view institution-offered certifications (CompTIA, Cisco, SAP, Certiport) and retrieve assigned keys in-app.
* **Web Admin CSV Upload (`web-admin/`):** Faculty (`admin`) upload a CSV of institutional emails and GMetrix keys.
* **Notifications & Unregistered Fallback:** Registered students receive an in-app notification and a content-free Expo Push Notification (raw keys are never included in push payloads). Unregistered students are rejected and returned in a downloadable CSV so the professor can distribute those keys manually via email or MS Teams.

### 2.6. Out of Scope (MVP)
* Automated email notifications for GMetrix keys (Phase 2).
* Free-form drag-and-drop org page builders and social features (likes, comments, student-to-student messaging).
* Complex multi-condition AND/OR form trees or file-upload form fields.
* Live third-party certification APIs (Cisco/SAP/GMetrix APIs) and payment processing.
* Multi-college / multi-campus expansion.

---

## 3. Architecture & Technical Reference

To prevent cross-document drift, all system diagrams, database schemas, RLS policies, encryption/key-rotation mechanisms, and Edge Function contracts are maintained exclusively in [Software_Architecture_Baseline.md](./Software_Architecture_Baseline.md) (`SCRUM-9`).

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Mobile App** | React Native + Expo (TypeScript) | Single codebase for Android/iOS with native camera, SQLite, and Expo Push APIs. |
| **Web Admin Portal** | Standalone Vite + React SPA (`web-admin/`) on Cloudflare Pages | Dedicated desktop interface for faculty CSV key uploads; excluded from mobile bundle and deployed independently with zero backend secrets on Cloudflare. |
| **Backend & DB** | Supabase (PostgreSQL, Auth + Resend SMTP, Storage, Edge Functions) | Managed relational DB with RLS, `@lpunetwork.edu.ph` OTP-verified auth, Vault/encryption support, and Deno Edge Functions (`compress-image`, `import-gmetrix-keys`). |

---

## 4. Project Management Metrics

### 4.1. SMART Objectives
* **Deployment:** Deliver full MVP parity across mobile and `web-admin/` within the 4-sprint schedule.
* **Adoption:** Onboard 80% of recognized CCS Main Organizations and Sub-Organizations within 2 weeks of launch.
* **Performance:** Maintain `< 200ms` local QR scan feedback offline and `< 10s` processing for 500-row GMetrix CSV uploads.
* **Reliability:** Achieve 100% offline-to-online attendance sync integrity with zero dropped scans.

### 4.2. Agile Timeline (4 Sprints)
* **Sprint 1 (Foundation & Security):** Verified `@lpunetwork.edu.ph` Email + Password + 6-digit OTP Auth (server-side domain hook + Resend SMTP), SQL-seeded admin, encrypted `profiles` + blind index + key rotation foundation, `department_info`, Main/Sub-Org hierarchy, RLS + `GRANT` migrations, CI/CD post-merge deploy fix, and `web-admin/` Vite SPA scaffold on Cloudflare Pages.
* **Sprint 2 (Org Hub & GMetrix Distribution):** Simplified org/sub-org pages + image compression pipeline (`compress-image`), announcements feed, Certification Directory, Web Admin GMetrix CSV import (`import-gmetrix-keys`), rejected-row CSV fallback, and content-free Expo Push + in-app notifications.
* **Sprint 3 (Events, Offline Attendance & Conditional Forms):** Onsite/online events, offline SQLite officer QR scanner (`clock_offset_ms`, cooldown, check-in/check-out + auto-checkout), conditional form builder (membership applications + post-event evaluations), and host evaluation metrics RPC.
* **Sprint 4 (Hardening, QA & Release):** Jest unit tests, Newman API tests, Playwright E2E tests for `web-admin/`, offline field testing, CodeQL/Snyk security review, and Expo EAS + Web Admin production cutover.

### 4.3. Resource Allocation
* **PM/PO:** 1 (Project management and requirements)
* **Devs:** 2 (Full-stack TypeScript / React Native / Web Admin / Supabase)
* **QA/DevOps:** 1 (Quality assurance, security gates, and CI/CD pipeline)
* **UI/UX:** 1 (User experience and interface design)

---

## 5. Approval Sign-off

* **Project Manager:** [caparasmarkrisen.mrc@gmail.com](mailto:caparasmarkrisen.mrc@gmail.com)
* **Lead DevOps / Author:** Alexis John L. Rellon
* **Date:** 2026-11-22
* **Signature:**
