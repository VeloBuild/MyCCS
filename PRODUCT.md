# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Enrolled CCS Students** (`student` role, mobile app): Lyceum of the Philippines University College of Information Technology and Computer Science (CCS — offering IT, CS, and LIS) students who verify with an `@lpunetwork.edu.ph` institutional email. They need one reliable place for department news, Main Org and Sub-Org pages, membership applications, onsite/online events, a permanent personal QR attendance ID, post-event evaluations, and GMetrix certification keys.
- **Organization Officers** (`officer` role, mobile app): Student leaders assigned to one or more Main Organizations or Sub-Organizations (keeping every student capability). They run event doors in zero-connectivity campus venues, manage org pages and announcements, review conditional membership applications, configure attendance rules, and inspect post-event evaluation metrics.
- **Faculty / Department Admins** (`admin` role, separate `web-admin/` desktop portal): CCS faculty and administrators who govern organizations, promote faculty admins, and distribute GMetrix keys via CSV upload. (Out of scope for the current Student + Org Officer demo surface.)

## Product Purpose

MyCCS replaces fragmented Facebook announcements, paper attendance sign-in sheets, ad-hoc Google Forms, and spreadsheet-mailed certification keys with one centralized, privacy-first platform for the College of Information Technology and Computer Science (IT, CS, and LIS). Success means students check one app for department and org life, officers scan attendance reliably offline in under 200ms with zero data loss on sync, and sensitive student PII and certification keys stay encrypted and private under RA 10173.

## Positioning

Unlike generic campus social apps or cloud-only event check-in tools, MyCCS combines an offline-first officer QR attendance engine (permanent opaque signed student QR tokens, cached display rosters, server-adjusted clock offsets, cooldowns, and auto-checkout) with RA 10173 privacy-by-design (encrypted PII, blind-indexed email matching, zero PII in QR codes or push notifications) in a two-tier Department → Main Org → Sub-Org hierarchy.

## Operating Context

- **Campus venues with dead Wi-Fi / cellular signal:** Officers scan student QR lanyards at auditorium and room doors offline; scans queue locally in SQLite and reconcile idempotently on sync.
- **Institutional trust & compliance:** `@lpunetwork.edu.ph` domain enforcement via server-side Supabase Auth Hook + 6-digit OTP via Resend SMTP; Republic Act No. 10173 (Data Privacy Act of 2012) notices on signup and key handling.
- **Two-tier org structure:** College Department (CCS) → Main Organizations (e.g., CCS Student Council) → Sub-Organizations (e.g., Web Dev Guild, Cyber Sec Circle, Data Science Society), each with independent pages, posts, conditional forms, and events.
- **Current build surface:** Interactive browser-runnable mobile prototype showcasing all 9 Student journey screens and 5 Org Officer journey screens (14 screens total) to establish `DESIGN.md` before full Expo React Native implementation.

## Capabilities and Constraints

- **Student Journey (9 screens):** (1) Sign up (`FR-AUTH-01`), (2) Verify 6-digit OTP (`FR-AUTH-01/02`), (3) Home feed with department/org announcements and key-ready alert (`FR-DEPT-02`, `FR-CERT-05`), (4) Org page + sub-orgs (`FR-ORG-01/02`), (5) Conditional membership application form with 4 field types and 1-level `visibleIf` (`FR-ORG-03`, `FR-FORM-01`), (6) Event detail + attendance rules (`FR-EVT-01/03`), (7) Permanent personal QR ID lanyard badge with offline indicator & flip (`FR-ATT-01`), (8) Certifications directory + masked My Keys (`FR-CERT-01/05`), (9) Post-event evaluation form (`FR-FORM-02`).
- **Org Officer Journey (5 screens):** (1) Manage org dashboard with org switcher and offline-ready readiness card (`FR-ATT-03`), (2) Create event + onsite attendance rules or online meeting link (`FR-EVT-01/02/03`), (3) Offline QR scanner with live queue count, check-in/late/cooldown/check-out states (`FR-ATT-02/04/05`), (4) Review conditional membership applicants (`FR-ORG-03`), (5) Post-event evaluation metrics (`FR-FORM-03`).
- **Hard MVP boundaries:** Read-only org posts (no likes, comments, or chat); 4 form field types (`short_text`, `single_choice`, `multi_choice`, `rating_1_5`) + 1-level `visibleIf`; raw GMetrix keys never appear in push alerts; `student_id` is never shown to other users; QR tokens contain no raw PII; all fonts must be bundled/self-hosted locally (no external font CDNs) for GDPR & RA 10173 compliance and offline reliability.
- **Target production stack:** Expo React Native (TypeScript) for mobile; standalone browser prototype for the current 14-screen demo and `DESIGN.md` establishment.

## Brand Commitments

- Name: **MyCCS** (College of Information Technology and Computer Science, Lyceum of the Philippines University — programs: IT, CS, and LIS).
- Official CCS department crest palette is confirmed as the visual baseline: Deep Crest Navy (`#0B2E59`), Circuit Royal Blue (`#0052CC`), Shield Cyan (`#0EA5E9`), and Laurel Gold (`#D4A500`) — a separate standalone MyCCS app logo will be supplied later.
- Existing PDF (`docs/user-journey/MyCCS-Screens-User-Journeys.pdf`) and persona wireframe images serve as functional journey references.

## Evidence on Hand

- `docs/jira/PRD_MyCCS.md`: Confirmed product requirements, RBAC, and MVP cutline.
- `docs/user-journey/MyCCS-Screens-User-Journeys.pdf` and `docs/user-journey/personas/{student,officer}/*.jpg`: Functional wireframe reference with sample names, counts, and keys (explicitly sample data; must be labeled as demo/sample data where appropriate).
- No real student photographs, official CCS crest SVG, or production telemetry exist yet — future work must not fabricate institutional endorsements or commercial claims.

## Product Principles

1. **Zero-ambiguity status under pressure:** Attendance windows, offline sync queues, application states, and key privacy must be legible in a glance at a noisy event door.
2. **Privacy made visible, never noisy:** RA 10173 assurances, masked keys, and PII-free QR badges build quiet institutional trust without cluttering primary tasks.
3. **One coherent world across roles:** Officers are students first; switching between Student and Org Officer modes should feel like stepping behind the counter of the same venue, not opening a different app.
4. **Honest structure over social noise:** Clean hierarchy, read-only org announcements, and crisp form logic replace noisy social feeds.

## Accessibility & Inclusion

- High contrast for bright outdoor campus hallways and dim auditorium doors (dark scanner mode, max-brightness QR badge option).
- Minimum 44px touch targets for one-handed mobile operation and rapid door scanning.
- Clear non-color status cues (labels + icons alongside color) for Present / Late / Absent and Approved / Pending / Rejected states.
