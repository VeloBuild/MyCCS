# Design: GMetrix CSV Key Distribution, Push Alerts & Faculty Promotion (`spec-05-gmetrix-csv-and-push`)

- **Jira Reference:** `SCRUM-14`
- **Roadmap Spec:** `spec-05-gmetrix-csv-and-push` (`openspec/ROADMAP.md`)
- **Related Specs:** [proposal.md](./proposal.md), [specs/gmetrix-csv-and-push/spec.md](./specs/gmetrix-csv-and-push/spec.md)
- **Authoritative Architecture:** `docs/jira/Software_Architecture_Baseline.md` (§5, §6, §7.2, §8, `ADR-008`, `ADR-009`), `DESIGN.md`

## Context

`spec-01` established encrypted `profiles` with `email_blind_index` (HMAC-SHA256 via Supabase Vault secret `myccs_email_blind_pepper`) and `promote_faculty_to_admin(uuid)`. `spec-03` established the isolated `web-admin/` Vite SPA with fail-closed admin guards and Edge Function CORS allowlisting. `spec-04` established the pure-`core.ts` + thin Deno 2 `index.ts` Edge Function architecture and the CCS Crest mobile hub (`MyCcsHubScreen`). `spec-05-gmetrix-csv-and-push` delivers Milestone 2's certification tables, encrypted GMetrix CSV batch import, content-free Expo Push delivery, `web-admin/` CSV upload and faculty promotion panels, and the authenticated mobile My Keys and Alerts experience.

## Goals / Non-Goals

**Goals:**
- Keep one source of truth for GMetrix CSV parsing, formula-injection sanitization, Expo Push token validation, notification deep links, and API DTO schemas in `shared/gmetrix.ts`.
- Share JWT claim verification and runtime env loading across `compress-image`, `import-gmetrix-keys`, and `my-certification-keys` via `supabase/functions/_shared/edge-auth.ts`.
- Share AES-256-GCM AEAD encryption/decryption (4-byte `key_version` AAD header + 12-byte IV + ciphertext/tag) and HMAC-SHA256 blind-index/key-hash helpers in `supabase/functions/_shared/gmetrix-crypto.ts` matching `shared/identity-crypto.ts`.
- Commit matched GMetrix keys, batch counts, and in-app notifications in a single atomic PostgreSQL RPC transaction (`commit_gmetrix_key_batch`) using `ON CONFLICT (key_code_hash) DO NOTHING` so partial commits and re-uploads are race-safe and idempotent.
- Ensure zero raw GMetrix keys appear in Expo Push payloads, `notifications` rows, `import-gmetrix-keys` HTTP responses, or client bundles.
- Ensure `web-admin/` faculty promotion uses O(1) `email_blind_index` lookup (`promote_faculty_by_email`) and lists only active `admin` accounts (`list_admin_profiles`) without exposing `student_id` or decrypting student rosters.

**Non-Goals:**
- Automated email sending for rejected/unregistered rows (Phase 2).
- Live third-party GMetrix/Certiport/Cisco/SAP API integrations (`PRD_MyCCS.md` §6).
- Configuring Expo EAS `projectId` or native APNs/FCM credentials (`spec-08-qa-security-release`).

## Surfaces Touched

- **`shared/`:**
  - `shared/gmetrix.ts`: Zod DTO schemas (`CertificationSchema`, `CertificationCreateInputSchema`, `CertificationKeyBatchSchema`, `DecryptedCertificationKeySchema`, `NotificationSchema`, `ExpoPushTokenSchema`, `PushPlatformSchema`, `RejectedRowReasonSchema`, `RejectedRowSchema`, `ImportGMetrixKeysResponseSchema`, `AdminDirectoryEntrySchema`, `PromoteFacultyResultSchema`), `maskCertificationKey`, `parseNotificationDeepLink`, and single-source re-exports of CSV constants, streaming RFC 4180 `parseGMetrixCsv`, control-char-hardened OWASP `sanitizeCsvCell`, and `buildRejectedRowsCsv` from `supabase/functions/_shared/gmetrix-csv.ts`.
  - `shared/identity-crypto.ts`: Wraps shared pure WebCrypto primitives from `supabase/functions/_shared/gmetrix-crypto.ts` with Zod validation.
  - `shared/dept-org.ts`: Extend `MobileHubRoute` union with `{ tab: 'keys'; section: 'my_keys' | 'directory' | 'notifications' }`.
  - `shared/index.ts`: Export `./gmetrix`.
- **`supabase/`:**
  - `supabase/migrations/20261128000001_spec05_gmetrix_csv_and_push.sql`: Tables `certifications`, `certification_key_batches`, `certification_keys`, `notifications`, `push_tokens`; indexes; RLS + `FORCE ROW LEVEL SECURITY` + explicit `GRANT`s; `SECURITY INVOKER` column-immutability triggers on `certification_keys`, `notifications`, and `push_tokens`; `service_role`-only RPCs `get_gmetrix_runtime_secrets(p_include_blind_pepper, p_include_cert_key)`, `lookup_active_profiles_by_blind_indexes(text[])`, `load_push_tokens_for_profiles(uuid[])`, `delete_push_tokens_by_values(text[])`, and set-based CTE `commit_gmetrix_key_batch(...)`; `authenticated` RPCs `register_push_token(...)`, `list_admin_profiles()`, and `promote_faculty_by_email(text)`.
  - `supabase/functions/_shared/edge-auth.ts`: Shared `authenticateEdgeRequest`, `validateJwtClaims`, `resolveExpectedJwtIssuer`, `extractBearerToken`, `resolveSupabaseRuntimeEnv`, `readStreamWithLimit`.
  - `supabase/functions/_shared/gmetrix-crypto.ts`: Single-source WebCrypto HMAC-SHA256 (`createHmacKey`, `signEmailBlindIndex`, `signKeyCodeHash`, `computeEmailBlindIndex`, `computeKeyCodeHash`) and versioned AES-256-GCM AEAD (`createAesGcmKey`, `encryptWithAesKey`, `decryptWithAesKey`, `encryptKeyCode`, `decryptKeyCode`, `parseKeyRingEnv`).
  - `supabase/functions/_shared/gmetrix-csv.ts`: Single-source zero-dep RFC 4180 streaming `parseGMetrixCsv`, control-char-safe OWASP `sanitizeCsvCell`, and `buildRejectedRowsCsv`.
  - `supabase/functions/compress-image/{core.ts,deno.json}`: Reuse `../_shared/edge-auth` while preserving all existing exports.
  - `supabase/functions/import-gmetrix-keys/{core.ts,index.ts,deno.json}`: Pure HTTP handler + Deno 2 entrypoint for `POST /functions/v1/import-gmetrix-keys` (supports `multipart/form-data` and `application/json`, RPC-backed lookups/token queries, selective 60s-cached Vault fallback, 4-way bounded concurrency Expo Push under shared 8s budget, `DeviceNotRegistered` token pruning).
  - `supabase/functions/my-certification-keys/{core.ts,index.ts,deno.json}`: Pure HTTP handler + Deno 2 entrypoint for `GET /functions/v1/my-certification-keys` returning caller-scoped decrypted keys with selective 60s-cached Vault key ring and automatic retry on unknown `keyVersion`.
  - `supabase/config.toml`: Add `[functions.import-gmetrix-keys]` and `[functions.my-certification-keys]` with `verify_jwt = false` (explicit JWT verification inside each handler).
  - `supabase/seed.sql` & `supabase/development/01_web_admin_placeholder_data.sql`: Seed Vault secret `myccs_cert_key_encryption_key` and sample dev certifications (CompTIA, Cisco, Certiport).
- **`web-admin/`:**
  - `web-admin/tsconfig.json` & `web-admin/vite.config.ts`: Include `../shared/gmetrix.ts` and `../supabase/functions/_shared/gmetrix-csv.ts`.
  - `web-admin/src/services/gmetrixAdmin.ts`: Typed Supabase REST/RPC/Edge Function client for certifications, batches, `import-gmetrix-keys`, `list_admin_profiles`, `promote_faculty_by_email`, and 5s-delayed Blob CSV download.
  - `web-admin/src/components/GMetrixImportPanel.tsx`: Certification selector + inline create form, CSV file upload with race-safe local preview and input reset, summary counters, rejected-rows table, email/MS Teams fallback prompt, sanitized CSV download, and batch history ledger.
  - `web-admin/src/components/FacultyPromotionPanel.tsx`: Active admin list and verified `@lpunetwork.edu.ph` faculty promotion form.
  - `web-admin/src/components/AdminDashboardShell.tsx`, `web-admin/src/App.tsx`, `web-admin/src/styles.css`: Mount both modules cleanly in CCS Crest styling without breaking existing `web-admin-guard.spec.ts` selectors.
- **Mobile App (root):**
  - `app.json`: Set `"scheme": "myccs"`.
  - `package.json`: Append `tests/api/gmetrix-csv-push-rls.sql` to `db:test`.
  - `src/services/certifications.ts`: Typed fetchers for `certifications`, `notifications`, `markNotificationRead`, `markCertificationKeyViewed`, and `GET /functions/v1/my-certification-keys`.
  - `src/services/pushNotifications.ts`: Injectable push-token driver, `registerDevicePushToken` (`register_push_token` RPC), `unregisterDevicePushToken`, and `Linking` deep-link listener for `myccs://certifications/my-keys`.
  - `src/hooks/useKeysAndAlerts.ts`: Cohesive hook owning certifications, decrypted keys, notifications, race-safe unread badge refresh, live deep-link reloads, and sign-out push-token cleanup.
  - `src/components/CertificationsAndKeysView.tsx`: CCS Crest `My Keys` (masked monospace keys with Reveal/Hide + `viewed_at`), `Directory`, and `Alerts` views.
  - `src/screens/MyCcsHubScreen.tsx`: Add 5th bottom tab (`Keys`), unread alert indicator, and deep-link route synchronization via `useKeysAndAlerts`.
- **`tests/`:**
  - `tests/api/gmetrix-csv-push-rls.sql`: Rolled-back SQL/RLS/trigger/RPC verification suite.
  - `tests/api/import-gmetrix-keys.postman_collection.json`: Newman API test collection covering CORS, JWT, non-admin RBAC, partial commit, duplicate idempotency, formula-injection sanitization, and content-free push verification.
  - `tests/unit/gmetrix-csv-push.test.ts`: Jest tests for `shared/gmetrix.ts`, `_shared/gmetrix-crypto.ts`, `import-gmetrix-keys/core.ts`, `my-certification-keys/core.ts`, migration SQL, and Postman collection integrity.
  - `tests/unit/mobile-gmetrix-keys.test.ts`: Jest unit/component tests for `src/services/certifications.ts`, `src/services/pushNotifications.ts`, `CertificationsAndKeysView`, and `MyCcsHubScreen` Keys tab & deep-link flows.
  - `tests/e2e/web-admin-gmetrix.spec.ts`: Playwright E2E suite verifying CSV upload, partial commit counts, fallback CSV download content, certification creation, and faculty promotion in `web-admin/`.

## Database Schema, RLS, Grants & Encryption

| Table | `authenticated` GRANTs | RLS Summary | Mutation Guards |
| :--- | :--- | :--- | :--- |
| `public.certifications` | `SELECT, INSERT, UPDATE, DELETE` | Active profiles SELECT `is_active = true`; `admin` full CRUD | Active unique partial index `(lower(btrim(provider)), lower(btrim(title)))` |
| `public.certification_key_batches` | `SELECT` only | `admin` SELECT only | Server-only inserts via `service_role` (`commit_gmetrix_key_batch`); `CHECK (assigned_count + rejected_count = total_rows)` |
| `public.certification_keys` | `SELECT, UPDATE` only | Own rows SELECT/UPDATE (`auth.uid() = student_profile_id AND is_active_profile()`); `admin` SELECT | `SECURITY INVOKER` trigger restricts `authenticated` UPDATE to setting `viewed_at` only; `UNIQUE(key_code_hash)` |
| `public.notifications` | `SELECT, UPDATE` only | Own rows SELECT/UPDATE (`auth.uid() = profile_id AND is_active_profile()`) | `SECURITY INVOKER` trigger restricts `authenticated` UPDATE to setting `read_at` only; server-only inserts |
| `public.push_tokens` | `SELECT, INSERT, UPDATE, DELETE` | Own rows CRUD (`auth.uid() = profile_id AND is_active_profile()`) | `CHECK` on Expo token regex & platform; `register_push_token` RPC handles shared-device handover |

- **Encryption & Blind Index:**
  - `profiles.email_blind_index` = `HMAC-SHA256(normalize(email), myccs_email_blind_pepper)` hex.
  - `certification_keys.key_code_hash` = `HMAC-SHA256('gmetrix_key:' || upper(trim(key_code)), myccs_email_blind_pepper)` hex (domain-separated keyed hash resisting offline brute force while enforcing `UNIQUE(key_code_hash)`).
  - `certification_keys.key_code_enc` = AES-256-GCM AEAD (`uint32be(key_version) || iv_12 || ciphertext || tag_16` with `uint32be(key_version)` bound as AAD), keyed from `CERT_KEY_ENCRYPTION_KEY` / `CERT_KEY_RING_JSON` env or Vault `myccs_cert_key_encryption_key`.

## Core Data Shapes

```ts
export type RejectedRowReason =
  | 'invalid_email'
  | 'missing_key_code'
  | 'invalid_key_code'
  | 'duplicate_key_in_csv'
  | 'unregistered_student'
  | 'duplicate_key_existing';

export interface ImportGMetrixKeysResponse {
  batchId: string;
  certificationId: string;
  totalRows: number;
  assignedCount: number;
  rejectedCount: number;
  pushNotificationsSent: number;
  pushNotificationsFailed: number;
  rejectedRows: Array<{
    rowNumber: number;
    email: string;
    reason: RejectedRowReason;
  }>;
  rejectedRowsCsv: string;
}

export type MobileHubRoute =
  | { tab: 'feed' }
  | { tab: 'department'; mode: 'view' | 'edit' }
  | {
      tab: 'orgs';
      view:
        | { kind: 'directory' }
        | { kind: 'detail'; orgId: string; panel: 'posts' | 'edit_org' | 'new_post' };
    }
  | { tab: 'keys'; section: 'my_keys' | 'directory' | 'notifications' }
  | { tab: 'identity' };
```

## Decisions

1. **AES-256-GCM AEAD in Edge Functions + Vault Runtime Secret Bridge (`get_gmetrix_runtime_secrets`)**
   - *Decision:* Encrypt `certification_keys.key_code_enc` with WebCrypto AES-256-GCM (`key_version` AAD) in `import-gmetrix-keys` and decrypt strictly caller-owned rows in `my-certification-keys`, reading secrets from Edge env overrides or Vault via a `service_role`-only RPC.
   - *Rationale:* Keeps local dev `supabase db reset` Vault secrets automatically in sync with `profiles.email_blind_index`, supports multi-version `CERT_KEY_RING_JSON` rotation in production, and guarantees true AEAD with zero client-side key exposure.
   - *Alternative Considered:* Storing keys via `pgcrypto` `pgp_sym_encrypt` in SQL RPCs — rejected because SAB §8.2 specifies AEAD with `key_version` rotation and `import-gmetrix-keys` owns key encryption at the Edge Function boundary.

2. **Atomic Batch Commit via `commit_gmetrix_key_batch` SQL RPC**
   - *Decision:* After encrypting matched rows and resolving blind indices in `import-gmetrix-keys`, insert the batch, `certification_keys` (`ON CONFLICT (key_code_hash) DO NOTHING`), and `notifications` inside one PostgreSQL function transaction.
   - *Rationale:* Prevents partial crashes or concurrent duplicate uploads from producing mismatched batch counts, orphan batches, or duplicate notifications.

3. **Data-Minimized Faculty Promotion (`list_admin_profiles` + `promote_faculty_by_email`)**
   - *Decision:* List only current `admin` accounts in `web-admin/` and promote verified faculty by institutional email using O(1) `email_blind_index` lookup.
   - *Rationale:* Avoids bulk-decrypting student PII tables on admin page load (`RA 10173` data minimization) and keeps `student_id` completely inaccessible.

## Risks / Trade-offs

- **[Unregistered Row Manual Fallback]** → `shortcut: Unregistered CSV rows are returned in a sanitized CSV for manual email or MS Teams delivery (no automated email send); upgrade in Phase 2 when Resend transactional email notifications are added`.
- **[Native Expo Push Token Acquisition]** → `shortcut: Mobile push token acquisition uses an injectable PushTokenDriver plus native Linking deep links without installing expo-notifications yet because getExpoPushTokenAsync requires an EAS projectId; wire expo-notifications plugin and EAS projectId in spec-08-qa-security-release`.
- **[Best-Effort Push After DB Commit]** → Expo Push delivery runs after `commit_gmetrix_key_batch` commits so a transient Expo Push outage never loses assigned keys or in-app notifications; push sent/failed counts are reported in the response.

## Migration Plan

1. Commit `shared/`, `supabase/migrations/20261128000001_spec05_gmetrix_csv_and_push.sql`, `supabase/config.toml`, `supabase/seed.sql`, `supabase/development/`, `supabase/functions/`, `web-admin/`, `src/`, `app.json`, `package.json`, and `tests/` atomically in the `SCRUM-14` PR targeting `develop`.
2. Rollback drops the `spec-05` RPCs (`promote_faculty_by_email`, `list_admin_profiles`, `register_push_token`, `commit_gmetrix_key_batch`, `get_gmetrix_runtime_secrets`), triggers, and new tables (`push_tokens`, `notifications`, `certification_keys`, `certification_key_batches`, `certifications`) in reverse dependency order after verifying no production keys depend on them.
