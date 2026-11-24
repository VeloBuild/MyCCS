# Design: Auth & Privacy-First Identity (`spec-01-auth-identity`)

- **Jira Reference:** `SCRUM-10`
- **Roadmap Spec:** `spec-01-auth-identity` (`openspec/ROADMAP.md`)
- **Related Specs:** [proposal.md](./proposal.md), [specs/auth-identity/spec.md](./specs/auth-identity/spec.md)
- **Authoritative Architecture:** `docs/jira/Software_Architecture_Baseline.md` (§5, §6, §8, `ADR-008`, `ADR-011`)

## Context

See `proposal.md` for motivation (`FR-AUTH-01` through `FR-AUTH-03`, `ADR-008`, `ADR-011`). Currently the repository contains `supabase/config.toml` with `[auth.email] enable_signup = true` and `enable_confirmations = true`, `otp_length = 6`, and commented `[auth.hook.before_user_created]` and `[auth.email.smtp]` blocks, with no SQL migrations, no `supabase/seed.sql`, no `shared/` directory, and only the starter `App.tsx` in the root Expo mobile workspace.

Because `auto_expose_new_tables` is unset in `supabase/config.toml`, every new `public` table must enable RLS and declare explicit `GRANT` statements for `authenticated`. Furthermore, client bundles (Expo mobile and future `web-admin/`) must never embed encryption secrets or HMAC peppers.

## Goals / Non-Goals

**Goals:**
- Enforce `@lpunetwork.edu.ph` signup restriction inside PostgreSQL via Supabase's `before-user-created` Auth Hook.
- Enable Resend custom SMTP configuration and 6-digit signup OTP verification in `supabase/config.toml`.
- Provision `public.profiles` with AEAD-encrypted PII (`email_enc`, `full_name_enc`, `student_id_enc`), `key_version`, HMAC-SHA256 `email_blind_index`, permanent opaque `qr_token` (`v1.<profile_id>.<short_hmac>`), 3-role RBAC (`student | officer | admin`), soft deletes (`deleted_at`), RLS policies, and explicit `GRANT`s.
- Provide `shared/` Zod schemas and server-side crypto/QR helpers (`AES-256-GCM`, HMAC-SHA256 blind index, QR token sign/verify) reusable across Deno Edge Functions, backend tests, and shared contracts without leaking keys into client bundles.
- Seed initial Department Admin account(s) idempotently in `supabase/seed.sql` and wire mobile `expo-secure-store` session persistence with a minimal auth/QR identity flow.

**Non-Goals:**
- Building `web-admin/` Vite SPA or Cloudflare Pages CORS headers (`spec-03-web-admin-scaffold`).
- Creating `department_info`, `organizations`, `org_memberships`, or `announcements` (`spec-02-core-schema-rls`).
- Implementing full GMetrix CSV upload (`spec-05-gmetrix-csv-and-push`) or offline attendance scanner (`spec-06-events-and-offline-qr`).

## Surfaces Touched

- **`supabase/config.toml`**: Enable `[auth.hook.before_user_created]` targeting `pg-functions://postgres/public/hook_restrict_signup_domain`; wire `[auth.email.smtp]` Resend placeholders via `env(...)` so zero secrets are committed.
- **`supabase/migrations/20261123000001_spec01_auth_identity.sql`**: Create `pgcrypto` extension usage, `public.hook_restrict_signup_domain(jsonb)`, fail-closed Vault loader `public.get_identity_secret(text)`, `public.profiles` table, RLS helper functions (`is_admin()`, `current_user_role()`), immutable column guard trigger (`guard_profiles_immutable_columns()`), RLS policies, explicit `GRANT`s, and `provision_profile`, `get_my_profile`, and `promote_faculty_to_admin` RPCs.
- **`supabase/seed.sql`**: Idempotent seed for initial Department Admin user/profile (`role = 'admin'`) for local/staging verification.
- **`shared/auth.ts`**: Institutional email normalization/Zod validators (`@lpunetwork.edu.ph`), 6-digit OTP schema, 3-role RBAC enum (`student | officer | admin`), and safe profile DTOs omitting raw `student_id`.
- **`shared/identity-crypto.ts`**: Pure WebCrypto (`globalThis.crypto.subtle`) AES-256-GCM AEAD encrypt/decrypt with `key_version` envelope, HMAC-SHA256 `email_blind_index`, and `v1.<profile_id>.<short_hmac>` QR token generator/verifier.
- **Root Mobile App (`package.json`, `src/lib/supabase.ts`, `src/services/auth.ts`, `src/screens/AuthIdentityScreen.tsx`, `App.tsx`)**: Add `@supabase/supabase-js` + `expo-secure-store`, SecureStore storage adapter, signup/OTP/sign-in/sign-out/profile provisioning service, and minimal identity/QR screen.
- **Tests (`tests/unit/auth-identity.test.ts`, `tests/api/auth-identity-rls.sql`)**: Jest unit tests and SQL/RLS contract verification script.
- **Untouched in `spec-01`**: `web-admin/` and `supabase/functions/` (no Edge Functions added in this slice).

## Database Schema, RLS, Grants & Encryption

### 1. Server-Side `before-user-created` Auth Hook
- Function: `public.hook_restrict_signup_domain(event jsonb) returns jsonb` (`LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public`).
- Extracts `lower(trim(event->'user'->>'email'))`.
- Accepts only when normalized email matches `^[a-z0-9._%+-]+@lpunetwork\.edu\.ph$`.
- On mismatch, returns an HTTP 403 hook rejection object (`{"error": {"http_code": 403, "message": "Signup restricted to verified @lpunetwork.edu.ph institutional accounts."}}`) so GoTrue aborts user creation before inserting into `auth.users`.
- Privileges: `REVOKE ALL ON FUNCTION public.hook_restrict_signup_domain(jsonb) FROM PUBLIC, anon, authenticated;` and `GRANT EXECUTE ON FUNCTION public.hook_restrict_signup_domain(jsonb) TO supabase_auth_admin;` (plus `GRANT USAGE ON SCHEMA public TO supabase_auth_admin;`).

### 2. `public.profiles` Table Schema
- `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `student_id_enc bytea NOT NULL`
- `full_name_enc bytea NOT NULL`
- `email_enc bytea NOT NULL`
- `email_blind_index text NOT NULL UNIQUE`
- `key_version integer NOT NULL DEFAULT 1 CHECK (key_version >= 1)`
- `qr_token text NOT NULL UNIQUE CHECK (qr_token ~ '^v1\.[0-9a-f-]{36}\.[0-9a-f]{16,}$')`
- `role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'officer', 'admin'))`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `deleted_at timestamptz NULL`

### 3. Explicit `GRANT`s & Row Level Security
- `ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`
- `ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;`
- Explicit `GRANT`s:
  - `REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;`
  - `GRANT USAGE ON SCHEMA public TO authenticated;`
  - `GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;` (no direct `INSERT` or `DELETE` grant; creation is routed strictly through `public.provision_profile`, and soft delete uses `deleted_at`).
- Anti-recursion helper functions (`SECURITY DEFINER`, `STABLE`, `SET search_path = public`):
  - `public.current_user_role()`: returns the caller's `role` from `public.profiles` where `id = auth.uid() AND deleted_at IS NULL`.
  - `public.is_admin()`: returns `COALESCE(public.current_user_role() = 'admin', false)`.
  - `REVOKE ALL` on helpers from `PUBLIC`/`anon`; `GRANT EXECUTE` to `authenticated`.
- Immutable column guard trigger (`BEFORE UPDATE` `guard_profiles_immutable_columns()`):
  - Rejects direct `authenticated` client `UPDATE` attempts against `id`, `email_enc`, `email_blind_index`, `qr_token`, `key_version`, `created_at`, or `deleted_at`, and restricts `role` updates to `public.is_admin()`.
- Policies on `public.profiles`:
  - `profiles_select_own`: `FOR SELECT TO authenticated USING (auth.uid() = id AND deleted_at IS NULL)`
  - `profiles_select_admin`: `FOR SELECT TO authenticated USING (public.is_admin() AND deleted_at IS NULL)`
  - `profiles_update_own`: `FOR UPDATE TO authenticated USING (auth.uid() = id AND deleted_at IS NULL) WITH CHECK (auth.uid() = id AND role = public.current_user_role())` (blocks self-role escalation)
  - `profiles_update_admin`: `FOR UPDATE TO authenticated USING (public.is_admin() AND deleted_at IS NULL) WITH CHECK (public.is_admin())` (enables faculty promotion to `admin`)

### 4. Encryption, Blind Index & Opaque QR Architecture
- **Blind Index (`email_blind_index`)**: Lowercase hex `HMAC-SHA256(pepper, lower(trim(email)))`. Computed identically in `shared/identity-crypto.ts` (WebCrypto) and PostgreSQL (`extensions.hmac(..., 'sha256')`).
- **Opaque QR Token (`qr_token`)**: `v1.<profile_id>.<short_hmac>` where `<short_hmac>` is the first 24 hex characters (96 bits) of `HMAC-SHA256(qr_key, "v1:" || profile_id)` — zero `student_id`, `email`, or `full_name` encoded.
- **PII Encryption (`*_enc` + `key_version`)**: `shared/identity-crypto.ts` implements versioned AEAD (`AES-256-GCM`, 12-byte random IV + ciphertext + auth tag, prefixed with `key_version` metadata) for server/Edge-Function callers. On PostgreSQL profile provisioning and retrieval (`public.provision_profile` and `public.get_my_profile` `SECURITY DEFINER` RPCs), secrets are loaded fail-closed from `vault.decrypted_secrets` via `public.get_identity_secret(...)` (`shortcut: spec-01 provisions encrypted profiles via Postgres SECURITY DEFINER RPC + pgcrypto/Vault; upgrade to a shared EdgeCrypto Deno endpoint importing shared/identity-crypto.ts in spec-05 if cross-runtime AEAD key sharing is needed`), ensuring zero encryption keys ever enter the Expo mobile bundle.

## Decisions

1. **PostgreSQL `pg-functions://` Auth Hook vs HTTP Edge Function Hook**
   - *Decision:* Use a PostgreSQL `before-user-created` hook (`pg-functions://postgres/public/hook_restrict_signup_domain`) in `supabase/config.toml`.
   - *Rationale:* Zero cold-start latency, executes inside the database auth transaction without external HTTP hop or webhook secret management during Sprint 1, and aligns with the commented hook template already present in `supabase/config.toml`.
   - *Alternative Considered:* Deno Edge Function HTTP hook — rejected for Sprint 1 complexity (Ponytail smallest complete slice).

2. **Anti-Recursion `SECURITY DEFINER` Role Helpers for RLS**
   - *Decision:* Evaluate `is_admin()` and `current_user_role()` inside `SECURITY DEFINER` functions with `SET search_path = public` rather than self-querying `public.profiles` inline inside RLS expressions.
   - *Rationale:* Inline subqueries on `public.profiles` inside `profiles` RLS policies cause Postgres infinite recursion errors (`42P17`) when checking admin privileges or guarding `role` immutability on `UPDATE`.

3. **Pure WebCrypto in `shared/identity-crypto.ts` + Server-Only Key Boundary**
   - *Decision:* Build `shared/identity-crypto.ts` purely on WebCrypto (`globalThis.crypto.subtle`) with caller-supplied `CryptoKey`/key bytes, and run initial profile encryption inside the `SECURITY DEFINER` Postgres RPC `provision_profile`.
   - *Rationale:* WebCrypto runs natively across Deno 2 Edge Functions and Node/Jest without Node-only `crypto` imports, while keeping encryption keys and HMAC peppers completely outside the mobile bundle.

## Risks / Trade-offs

- **[Local vs Cloud Resend SMTP Secrets]** → `supabase/config.toml` must reference `env(RESEND_API_KEY)` (and local dev uses Supabase's built-in `[local_smtp]` on port `54324`), never raw credentials; CI and local tests without Resend remain fully deterministic.
- **[Postgres `pgcrypto` vs WebCrypto AES-GCM Interop]** → `HMAC-SHA256` digests (`email_blind_index`, `qr_token`) are byte-for-byte identical across Postgres `extensions.hmac` and `shared/identity-crypto.ts`. If `spec-05` needs Edge Functions to decrypt `profiles.full_name_enc` written by Postgres, migrating `provision_profile` to an Edge Function (`EdgeCrypto`) calling `shared/identity-crypto.ts` is straightforward and documented via the `shortcut:` marker.
- **[`supabase_auth_admin` Seed/Hook Drift]** → Migration grants `USAGE ON SCHEMA public` and `EXECUTE` on the hook function specifically to `supabase_auth_admin` and covers it in the SQL contract test.

## Migration Plan

1. Commit `supabase/config.toml`, `supabase/migrations/20261123000001_spec01_auth_identity.sql`, `supabase/seed.sql`, `shared/`, mobile source files, and tests atomically in the same `SCRUM-10` PR (Atomic Commit Rule).
2. Local/CI verification runs `npx tsc --noEmit`, `npm test -- --ci`, and SQL/RLS assertions against the migration.
3. Rollback strategy: because `spec-01` introduces a net-new `public.profiles` table and hook, rollback cleanly reverts the migration and disables `[auth.hook.before_user_created]` in `supabase/config.toml` without impacting pre-existing tables.
