# Proposal: Auth & Privacy-First Identity (`spec-01-auth-identity`)

- **Jira Reference:** `SCRUM-10`
- **Roadmap Spec:** `spec-01-auth-identity` (Milestone 1 — Foundation, Auth & Security, `openspec/ROADMAP.md`)
- **Owning Requirements:** `FR-AUTH` (`FR-AUTH-01`, `FR-AUTH-02`, `FR-AUTH-03`), `ADR-008`, `ADR-011`

## Why

Direct University Microsoft 365 Entra ID OAuth clearance is unavailable, so MyCCS needs an institutional authentication and identity foundation that proves `@lpunetwork.edu.ph` mailbox ownership while protecting student PII under Republic Act No. 10173. Implementing this slice first unlocks role-based access control, offline QR attendance, and blind-indexed GMetrix key matching for all downstream specs.

## What Changes

- Configure Supabase Email + Password signup with mandatory 6-digit email OTP verification (`enable_signup = true`, `enable_confirmations = true`, `otp_length = 6`) via Resend custom SMTP in `supabase/config.toml`.
- Add a server-side `before-user-created` Auth Hook (`hook_restrict_signup_domain`) that accepts `@lpunetwork.edu.ph` signups (after normalization) and rejects all other email domains at the auth boundary.
- Create the `public.profiles` migration with encrypted PII columns (`email_enc`, `full_name_enc`, `student_id_enc`), HMAC-SHA256 `email_blind_index`, `key_version`, permanent opaque signed `qr_token` (`v1.<profile_id>.<short_hmac>`), 3-role RBAC (`student | officer | admin`), soft deletes (`deleted_at`), mandatory Row Level Security, and explicit `GRANT`s for `authenticated` and `supabase_auth_admin`.
- Add `shared/` Zod contracts and identity cryptography primitives (institutional email validation/normalization, AEAD PII encryption with `key_version`, HMAC-SHA256 blind index, opaque QR token sign/verify, and private `student_id` projections).
- Add idempotent SQL seeding (`supabase/seed.sql`) for initial Department Admin account(s) and wire the mobile Expo SecureStore session adapter and minimal auth/identity flow.

## Capabilities

### New Capabilities
- `auth-identity`: Verified `@lpunetwork.edu.ph` signup with server-side domain hook, 6-digit email OTP verification, encrypted PII profile provisioning with `key_version` and HMAC-SHA256 blind-index lookup, private `student_id` enforcement with permanent opaque QR tokens, RLS + explicit `GRANT`s + admin bootstrapping, and mobile SecureStore session persistence.

### Modified Capabilities
None — `openspec/specs/` has no existing capability specs yet.

## Out of Scope

Per the MVP cutline (`docs/jira/PRD_MyCCS.md` §6) and roadmap sequencing:
- Direct University Microsoft 365 Entra ID / SSO OAuth integration.
- Automated Resend email notifications for GMetrix key distribution (Phase 2).
- `department_info`, `organizations`, `org_memberships`, and `announcements` schemas (`spec-02-core-schema-rls`).
- Standalone `web-admin/` Vite SPA scaffold and Cloudflare Pages setup (`spec-03-web-admin-scaffold`).
- Social engagement features (likes, comments, student messaging), third-party certification APIs, payment processing, and multi-campus support.

## Impact

- **Backend (`supabase/`):** `supabase/config.toml`, new SQL migration in `supabase/migrations/`, and `supabase/seed.sql`.
- **Shared Contracts (`shared/`):** New TypeScript types, Zod schemas, and server-side crypto/QR utilities in `shared/`.
- **Mobile App (root):** Expo SecureStore dependency (`expo-secure-store`) and Supabase client, auth service, and minimal auth/QR identity UI in `src/` and `App.tsx`.
- **Tests (`tests/`):** Focused Jest unit tests (`tests/unit/`) and SQL/API contract tests (`tests/api/`) covering domain rejection, OTP confirmation, blind-index determinism, encryption/`key_version`, `student_id` privacy, and `profiles` RLS/`GRANT`s.
