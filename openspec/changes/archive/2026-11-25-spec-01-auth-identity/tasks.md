# Tasks: Auth & Privacy-First Identity (`spec-01-auth-identity`)

- **Jira Reference:** `SCRUM-10`
- **Spec:** [specs/auth-identity/spec.md](./specs/auth-identity/spec.md)
- **Design:** [design.md](./design.md)

## 1. Shared Auth, Crypto & Identity Contracts (`shared/`)

- [x] 1.1 Create `shared/auth.ts` with Zod schemas for `@lpunetwork.edu.ph` email normalization/validation, 6-digit OTP verification payloads, 3-role RBAC enum (`student | officer | admin`), and safe profile DTOs excluding raw `student_id`; verify with focused unit tests in `tests/unit/auth-identity.test.ts` (`npm test -- tests/unit/auth-identity.test.ts`).
- [x] 1.2 Create `shared/identity-crypto.ts` implementing WebCrypto AEAD (`AES-256-GCM`) PII encryption/decryption with `key_version`, deterministic HMAC-SHA256 `email_blind_index` computation on normalized institutional email, and opaque permanent QR token signing/verification (`v1.<profile_id>.<short_hmac>`); verify round-trip, determinism, `student_id` exclusion, and tamper rejection via `npm test -- tests/unit/auth-identity.test.ts`.

## 2. Supabase Auth Hook, `profiles` Migration, RLS, Explicit `GRANT`s & Admin Seed (`supabase/`)

- [x] 2.1 Configure `supabase/config.toml` for 6-digit OTP email confirmation (`enable_signup = true`, `enable_confirmations = true`, `otp_length = 6`), Resend SMTP placeholders (`env(...)`), and `[auth.hook.before_user_created]` pointing to `pg-functions://postgres/public/hook_restrict_signup_domain`; verify config syntax and absence of plaintext credentials.
- [x] 2.2 Create migration `supabase/migrations/20261123000001_spec01_auth_identity.sql` defining `public.hook_restrict_signup_domain` (with `supabase_auth_admin` execution grants and `REVOKE` from `PUBLIC`/`anon`/`authenticated`), `public.profiles` (`email_enc`, `full_name_enc`, `student_id_enc`, `email_blind_index`, `key_version`, `qr_token`, `role`, timestamps), `ENABLE ROW LEVEL SECURITY`, anti-recursion RLS helper functions and policies (own-profile select/update without role change, admin select/faculty-promotion update), explicit `GRANT`s for `authenticated`, and `public.provision_profile` RPC; verify constraints and policies against `tests/api/auth-identity-rls.sql`.
- [x] 2.3 Create `supabase/seed.sql` to idempotently seed the initial Department Admin user and `public.profiles` row with encrypted PII, `email_blind_index`, `key_version = 1`, opaque `qr_token`, and `role = 'admin'`; verify idempotent `ON CONFLICT` handling matches the `public.profiles` migration schema.

## 3. Mobile Expo SecureStore Session & Auth Flow (`root mobile app`)

- [x] 3.1 Install `@supabase/supabase-js` and `expo-secure-store`, add the SecureStore session storage adapter (`src/lib/supabase.ts`) and auth service (`src/services/auth.ts`) supporting `@lpunetwork.edu.ph` Email + Password signup, 6-digit OTP verification (`verifyOtp`), sign-in, sign-out, and profile provisioning; verify SecureStore persistence/cleanup and OTP auth flow with mocked Jest tests in `tests/unit/auth-identity.test.ts`.
- [x] 3.2 Wire minimal mobile auth & permanent personal QR identity screen in `src/screens/AuthIdentityScreen.tsx` and `App.tsx` (Ponytail smallest complete slice: institutional signup, 6-digit OTP input, login, and authenticated student profile card rendering the opaque `qr_token` without exposing raw `student_id`); verify with React Native Testing Library assertions in `tests/unit/auth-identity.test.ts` and `npx tsc --noEmit`.

## 4. Integration Verification & Local Gates (`tests/` & CI Parity)

- [x] 4.1 Verify complete `spec-01-auth-identity` unit suite (`tests/unit/auth-identity.test.ts`: domain rejection, OTP verification, blind-index lookup, AEAD encryption/`key_version`, `student_id` privacy & opaque QR token verification, SecureStore session persistence, and UI rendering) passes `npm test -- --ci`.
- [x] 4.2 Verify SQL/RLS contract suite (`tests/api/auth-identity-rls.sql` covering `hook_restrict_signup_domain`, cross-student RLS isolation, role immutability, admin promotion, and explicit `GRANT`s), document any `shortcut:` markers in `openspec/ROADMAP.md`, and pass `bash .agents/skills/myccs-workflow/scripts/gates.sh`.

## Workflow follow-up

- Review generated OpenSpec artifacts (`proposal.md`, `specs/auth-identity/spec.md`, `design.md`, `tasks.md`) before starting implementation (`openspec-apply-change`).
- Archive the change once implementation and verification pass (`openspec-archive-change`), check off `spec-01-auth-identity` in `openspec/ROADMAP.md`, and run `graphify update .`.
