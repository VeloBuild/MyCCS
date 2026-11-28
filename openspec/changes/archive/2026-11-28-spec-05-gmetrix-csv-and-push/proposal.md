# Proposal: GMetrix CSV Key Distribution, Push Alerts & Faculty Promotion (`spec-05-gmetrix-csv-and-push`)

- **Jira Reference:** `SCRUM-14`
- **Roadmap Spec:** `spec-05-gmetrix-csv-and-push` (Milestone 2, Org Hub, Media & GMetrix Distribution, `openspec/ROADMAP.md`)
- **Owning Requirements:** `FR-CERT` (`FR-CERT-01`, `FR-CERT-02`, `FR-CERT-03`, `FR-CERT-04`, `FR-CERT-05`), `FR-AUTH-02`, `SAB §6`, `SAB §7.2`, `SAB §8`, `ADR-008`, `ADR-009`

## Why

Faculty currently distribute GMetrix certification keys manually through spreadsheets and ad-hoc chat messages, exposing keys and creating manual reconciliation errors. Delivering the certification schema, the `import-gmetrix-keys` Edge Function, the `web-admin/` upload and faculty promotion modules, and the authenticated mobile My Keys and content-free push flow completes Milestone 2 under RA 10173 encryption and blind-index isolation.

## What Changes

- Add shared GMetrix, Certification Directory, Notification, Push Token, CSV parsing, and spreadsheet formula-injection sanitization contracts in `shared/gmetrix.ts` (re-exported via `shared/index.ts`), plus extend `MobileHubRoute` in `shared/dept-org.ts` with a `keys` tab.
- Extract shared Edge Function JWT claim and runtime-env validation into `supabase/functions/_shared/edge-auth.ts` and AES-256-GCM / HMAC blind-index primitives into `supabase/functions/_shared/gmetrix-crypto.ts` (reused by `compress-image`, `import-gmetrix-keys`, and `my-certification-keys`).
- Add a PostgreSQL migration (`supabase/migrations/20261128000001_spec05_gmetrix_csv_and_push.sql`) creating `certifications`, `certification_key_batches`, `certification_keys` (encrypted `key_code_enc` + unique HMAC `key_code_hash` + `key_version`), `notifications`, and `push_tokens` with mandatory RLS, `FORCE ROW LEVEL SECURITY`, explicit `GRANT` statements for `authenticated`, `SECURITY INVOKER` update guards, `service_role`-only Vault secret and atomic batch-commit RPCs, `register_push_token`, `list_admin_profiles`, and `promote_faculty_by_email`.
- Implement `POST /functions/v1/import-gmetrix-keys` performing CORS, JWT, and `admin` role checks, RFC 4180 CSV parsing, HMAC-SHA256 `email_blind_index` matching against active profiles, idempotent partial commit via AES-256-GCM AEAD encryption and `UNIQUE(key_code_hash)`, content-free Expo Push API v2 delivery (chunked at 100 messages with `DeviceNotRegistered` token pruning), and formula-injection-sanitized (`=`, `+`, `-`, `@`, `\t`, `\r`) rejected-rows CSV output.
- Implement `GET /functions/v1/my-certification-keys` verifying caller JWT and decrypting only the authenticated user's own `certification_keys` rows server-side without exposing encryption keys to clients.
- Mount the GMetrix CSV upload UI (certification selector/creator, batch summary counts, rejected-rows table, manual email/MS Teams fallback prompt, downloadable sanitized CSV, and batch history) and faculty-to-admin promotion UI inside `web-admin/`.
- Add the mobile `Keys` tab (`My Keys`, `Directory`, `Alerts`), deep-link routing (`myccs://certifications/my-keys`), masked key reveal with `viewed_at` tracking, and push token registration service in `src/`.
- Add SQL RLS tests (`tests/api/gmetrix-csv-push-rls.sql`), Postman/Newman API tests (`tests/api/import-gmetrix-keys.postman_collection.json`), Jest unit/component tests (`tests/unit/gmetrix-csv-push.test.ts`, `tests/unit/mobile-gmetrix-keys.test.ts`), and Playwright `web-admin/` E2E tests (`tests/e2e/web-admin-gmetrix.spec.ts`).

## Capabilities

### New Capabilities
- `gmetrix-csv-and-push`: Certification Directory, encrypted GMetrix key batch import with blind-index email matching and idempotent partial commits, formula-injection-sanitized fallback CSV export, `web-admin/` CSV distribution and faculty-to-admin promotion UI, content-free Expo Push alerts, in-app notifications, and authenticated mobile My Keys retrieval.

### Modified Capabilities
None. Existing `auth-identity`, `core-schema-rls`, `web-admin-scaffold`, and `dept-and-org-pages` requirements remain intact.

## Out of Scope

Per the MVP cutline (`docs/jira/PRD_MyCCS.md` §6) and roadmap sequencing:
- Automated transactional email delivery for unregistered GMetrix CSV rows (Phase 2; MVP returns a sanitized fallback CSV for manual email or MS Teams delivery).
- Live third-party GMetrix, Certiport, Cisco, or SAP certification APIs and payment processing.
- Events, offline QR attendance scanning, guest passes, and conditional form builders (`spec-06`, `spec-06b`, `spec-07`).
- Production Expo EAS `projectId` push credential provisioning (`spec-08-qa-security-release`).

## Impact

- **Shared Contracts (`shared/`):** New `shared/gmetrix.ts`; updated `shared/dept-org.ts` and `shared/index.ts`.
- **Backend (`supabase/`):** New `supabase/migrations/20261128000001_spec05_gmetrix_csv_and_push.sql`, `supabase/functions/_shared/{edge-auth,gmetrix-crypto}.ts`, `supabase/functions/import-gmetrix-keys/{core.ts,index.ts,deno.json}`, `supabase/functions/my-certification-keys/{core.ts,index.ts,deno.json}`; updated `supabase/functions/compress-image/{core.ts,deno.json}`, `supabase/config.toml`, `supabase/seed.sql`, and `supabase/development/01_web_admin_placeholder_data.sql`.
- **Web Admin (`web-admin/`):** New `web-admin/src/services/gmetrixAdmin.ts`, `web-admin/src/components/{GMetrixImportPanel,FacultyPromotionPanel}.tsx`; updated `web-admin/src/components/AdminDashboardShell.tsx`, `web-admin/src/App.tsx`, `web-admin/src/styles.css`, `web-admin/tsconfig.json`.
- **Mobile App (root):** New `src/services/{certifications,pushNotifications}.ts`, `src/components/CertificationsAndKeysView.tsx`; updated `src/screens/MyCcsHubScreen.tsx`, `app.json`, `package.json`.
- **Tests (`tests/`):** New `tests/api/gmetrix-csv-push-rls.sql`, `tests/api/import-gmetrix-keys.postman_collection.json`, `tests/unit/gmetrix-csv-push.test.ts`, `tests/unit/mobile-gmetrix-keys.test.ts`, `tests/e2e/web-admin-gmetrix.spec.ts`.
