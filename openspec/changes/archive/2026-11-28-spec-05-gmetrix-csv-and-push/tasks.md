# Tasks: GMetrix CSV Key Distribution, Push Alerts & Faculty Promotion (`spec-05-gmetrix-csv-and-push`)

- **Jira Reference:** `SCRUM-14`
- **Spec:** [specs/gmetrix-csv-and-push/spec.md](./specs/gmetrix-csv-and-push/spec.md)
- **Design:** [design.md](./design.md)

## 1. Shared Contracts, Edge Shared Primitives & Database Migration (`shared/`, `supabase/`)

- [x] 1.1 Create `shared/gmetrix.ts` (Zod schemas, RFC 4180 CSV parser, OWASP formula-injection cell sanitizer, rejected-rows CSV builder, masked key formatter, and deep-link parser), extend `MobileHubRoute` in `shared/dept-org.ts` with `keys`, and export from `shared/index.ts`; verify with `npx tsc --noEmit`.
- [x] 1.2 Extract shared JWT/env/body helpers into `supabase/functions/_shared/edge-auth.ts`, add `supabase/functions/_shared/gmetrix-crypto.ts` (HMAC blind-index/key-hash + versioned AES-256-GCM AEAD), and wire `supabase/functions/compress-image/{core.ts,deno.json}` to reuse `_shared/edge-auth`; verify `npm test -- tests/unit/compress-image.test.ts` stays green.
- [x] 1.3 Create `supabase/migrations/20261128000001_spec05_gmetrix_csv_and_push.sql` (`certifications`, `certification_key_batches`, `certification_keys`, `notifications`, `push_tokens`, RLS + `FORCE RLS`, explicit `GRANT`s, `SECURITY INVOKER` triggers, `get_gmetrix_runtime_secrets`, `commit_gmetrix_key_batch`, `register_push_token`, `list_admin_profiles`, `promote_faculty_by_email`), update `supabase/config.toml`, `supabase/seed.sql`, `supabase/development/01_web_admin_placeholder_data.sql`, and `package.json` `db:test`; verify migration contract via `tests/api/gmetrix-csv-push-rls.sql` and unit assertions.

## 2. Edge Functions & API/SQL Tests (`supabase/functions/`, `tests/api/`, `tests/unit/`)

- [x] 2.1 Implement `supabase/functions/import-gmetrix-keys/{core.ts,index.ts,deno.json}` (CORS, JWT, `admin` RBAC, bounded multipart/JSON CSV ingest, HMAC blind-index matching, AES-256-GCM key encryption, atomic partial-commit idempotency, chunked content-free Expo Push delivery with `DeviceNotRegistered` token pruning, and formula-injection-sanitized rejected-rows CSV) and `supabase/functions/my-certification-keys/{core.ts,index.ts,deno.json}` (caller-scoped key decryption).
- [x] 2.2 Add `tests/api/gmetrix-csv-push-rls.sql`, `tests/api/import-gmetrix-keys.postman_collection.json`, and `tests/unit/gmetrix-csv-push.test.ts` covering CSV partial commit, duplicate key idempotency, formula injection (`=`, `+`, `-`, `@`), content-free push payloads, `DeviceNotRegistered` cleanup, key decryption scoping, and SQL RLS invariants; verify `npm test -- tests/unit/gmetrix-csv-push.test.ts` passes.

## 3. Standalone Web Admin Portal & Playwright E2E (`web-admin/`, `tests/e2e/`)

- [x] 3.1 Implement `web-admin/src/services/gmetrixAdmin.ts`, `web-admin/src/components/GMetrixImportPanel.tsx`, and `web-admin/src/components/FacultyPromotionPanel.tsx`, wire them into `AdminDashboardShell.tsx`, `App.tsx`, `styles.css`, and `web-admin/tsconfig.json`; verify `npm run web-admin:build` succeeds with zero TypeScript errors.
- [x] 3.2 Add `tests/e2e/web-admin-gmetrix.spec.ts` covering admin certification creation, CSV upload, partial-commit summary counts, email/MS Teams fallback prompt, sanitized rejected-rows CSV download, and faculty-to-admin promotion, and verify both `web-admin-guard.spec.ts` and `web-admin-gmetrix.spec.ts` pass via `npm run test:e2e`.

## 4. Mobile Certification Directory, My Keys & Push Deep Links (`src/`, `app.json`, `tests/unit/`)

- [x] 4.1 Implement `src/services/certifications.ts`, `src/services/pushNotifications.ts`, `src/components/CertificationsAndKeysView.tsx`, wire the `Keys` tab and `myccs://certifications/my-keys` deep link into `src/screens/MyCcsHubScreen.tsx`, and set `"scheme": "myccs"` in `app.json`; add `tests/unit/mobile-gmetrix-keys.test.ts` and verify `npm test -- tests/unit/mobile-gmetrix-keys.test.ts` and `tests/unit/dept-org-pages.test.ts` pass.

## 5. Full Verification, Audits & Coverage Gates

- [x] 5.1 Run full verification (`npx tsc --noEmit`, `npm run web-admin:build`, `npm test -- --coverage --ci`, `npm run test:e2e`, `openspec validate spec-05-gmetrix-csv-and-push --strict`, `openspec-verify-change`), execute `ponytail-audit` and `no-comments` (`comment-sicko`), apply accepted findings, and re-verify all checks green.

## Workflow follow-up

- Archive `spec-05-gmetrix-csv-and-push` via `openspec-archive-change` (sync main spec to `openspec/specs/gmetrix-csv-and-push/spec.md`), check off `spec-05-gmetrix-csv-and-push` and log any bugs/shortcuts in `openspec/ROADMAP.md`, and run `graphify update .`.
- Push `feat/SCRUM-14-spec-05-gmetrix-csv-and-push`, open PR targeting `develop`, verify CI checks green, run `coderabbit-pr-gate` (`--wait`), apply valid CodeRabbit findings until all checks pass, and Squash & Merge into `develop`.
