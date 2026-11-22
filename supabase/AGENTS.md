# Supabase Directory Agent Instructions (`supabase/`)

## Purpose

Contains Supabase local configuration (`config.toml`), PostgreSQL migrations (`migrations/`), and Deno 2 Edge Functions (`functions/`).

## Mandatory Rules

1. **Verified Institutional Email Auth (`@lpunetwork.edu.ph`):** Keep `[auth.email] enable_signup = true` and `enable_confirmations = true` in `config.toml` with Resend custom SMTP (6-digit signup OTP) and a server-side `before-user-created` Auth Hook restricting signups strictly to `@lpunetwork.edu.ph`. Seed initial admins via SQL and enforce `admin` role for faculty promotion.
2. **RLS + Explicit `GRANT`s:** Every migration creating a `public` table MUST enable Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and include explicit `GRANT` statements for `authenticated`.
3. **3-Role RBAC:** Enforce `student | officer | admin` (faculty operate under `admin`) in RLS policies and Edge Functions—never trust client-supplied roles.
4. **PII Encryption & Blind Index:** Store student PII (`email_enc`, `full_name_enc`, `student_id_enc`) and `certification_keys.key_code_enc` encrypted with `key_version`. Use `profiles.email_blind_index` (HMAC-SHA256) for GMetrix CSV lookups and keep `student_id` private.
5. **Edge Function JWT Verification:** Every Edge Function (`compress-image`, `import-gmetrix-keys`) must validate the caller's JWT and role before touching Storage or service-role writes.
6. **Atomic Commit Rule:** Commit SQL migrations and Edge Function changes in the same commit/PR as the corresponding mobile, `web-admin/`, or `shared/` changes.
7. **Destructive Changes:** Never drop tables/columns or alter encrypted columns without an explicit backup/migration plan (see `.agents/plugins/myccs-plugin/rules/migration-safety.md`).

## References

- [Software Architecture Baseline (`SCRUM-9`)](../docs/jira/Software_Architecture_Baseline.md)
- [Repo Rules](../rules.md)
