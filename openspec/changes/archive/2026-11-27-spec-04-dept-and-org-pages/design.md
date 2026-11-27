# Design: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`)

- **Jira Reference:** `SCRUM-13`
- **Roadmap Spec:** `spec-04-dept-and-org-pages` (`openspec/ROADMAP.md`)
- **Related Specs:** [proposal.md](./proposal.md), [specs/dept-and-org-pages/spec.md](./specs/dept-and-org-pages/spec.md)
- **Authoritative Architecture:** `docs/jira/Software_Architecture_Baseline.md` (§5, §6, §7.3, §8, `ADR-007`), `DESIGN.md`

## Context

`spec-02-core-schema-rls` created `public.department_info`, `public.organizations`, `public.org_memberships`, and `public.announcements` with 3-role RBAC RLS and triggers. `spec-04-dept-and-org-pages` adds the user-facing mobile hub for those entities, the `org-media` Storage bucket, and the `POST /functions/v1/compress-image` Edge Function pipeline so org cover images, logos, and future event flyers are pre-compressed on-device and normalized server-side with EXIF stripping and WebP conversion.

## Goals / Non-Goals

**Goals:**
- Keep one source of truth for media upload constraints (5 MiB limit, magic-byte inspection, storage paths, upload authorization) and department/organization view logic in `shared/`.
- Provision the `org-media` Supabase Storage bucket with zero client write policies so direct Storage uploads cannot bypass EXIF stripping or role checks.
- Structure `supabase/functions/compress-image/` into a pure runtime-agnostic handler (`core.ts`) plus a thin Deno 2 entrypoint (`index.ts`) using `@imagemagick/magick-wasm` so Jest executes the real HTTP handler directly alongside Postman/Newman API tests.
- Deliver the CCS Crest (`DESIGN.md`) authenticated mobile hub (`Feed`, `Department`, `Orgs`, `Identity`) without breaking standalone `AuthIdentityScreen` flows or tests.

**Non-Goals:**
- Interactive social features (likes, comments) or drag-and-drop org page builders (`PRD_MyCCS.md` §6).
- Conditional membership application forms and applicant review screens (`spec-07`).
- GMetrix CSV import or push notifications (`spec-05`).
- New `public` relational tables (all relational tables already exist from `spec-02`).

## Surfaces Touched

- **`shared/`:**
  - `shared/media-upload.ts`: `MAX_MEDIA_UPLOAD_BYTES` (5 MiB), `MEDIA_STORAGE_BUCKET` (`org-media`), `ALLOWED_INPUT_IMAGE_MIME_TYPES`, `OUTPUT_IMAGE_MIME_TYPE`, `MEDIA_VARIANT_LIMITS`, `MediaKindSchema`, `CompressImageRequestMetaSchema`, `CompressImageResponseSchema`.
  - `shared/dept-org.ts`: `AnnouncementFilter`, `MobileHubRoute` discriminated union, `OrganizationTreeNode`, `parseOptionalExpiryInput`, `formatManilaDate`, `buildOrganizationTree`, `filterAnnouncementsFeed`, `getOrganizationPosts`, `isAnnouncementExpired`, `normalizeDepartmentContacts`, `getOrgInitials`.
  - `shared/core-schema.ts` & `shared/index.ts`: Case-insensitive `URL` protocol validation in `SafeHttpUrlSchema`, `DepartmentInfoCreateInputSchema`, and exports for both modules.
- **`supabase/`:**
  - `supabase/migrations/20261127000001_spec04_org_media_storage.sql`: Create/update `storage.buckets` (`org-media`, `public = true`, `file_size_limit = 5242880`, `allowed_mime_types = ARRAY['image/webp']`), read-only `SELECT` policy on `storage.objects` for active `authenticated` users (zero client `INSERT`/`UPDATE`/`DELETE` policies), and `trg_organizations_guard_media_urls` / `public.guard_organizations_media_urls()` trigger on `public.organizations` blocking direct non-NULL `authenticated` writes to `logo_url`/`cover_url` while verifying `storage.objects` existence and `org-media/orgs/<id>/(logo|cover)/<uuid>.webp` URL format on `service_role` writes.
  - `supabase/config.toml`: Configure `[storage.buckets.org-media]` and `[functions.compress-image] verify_jwt = false` (JWT is explicitly verified in handler via `aud`/`iss` + `claims.sub === verifiedUser.id` + `auth.getUser(token)`).
  - `supabase/functions/compress-image/core.ts`: Single server validator and pure HTTP handler implementing CORS, method check, Bearer JWT (`aud`/`iss`/`exp`/`sub` + optional `SUPABASE_JWT_ISSUER`) + `getUser` match, streaming body byte cap (`5 MiB + 64 KiB`), RBAC check before `file.arrayBuffer()` (with `403`-first denial), magic-byte MIME verification, image transform call, service-role Storage upload, direct `service_role` persistence of `organizations.logo_url`/`cover_url`, and structured JSON responses.
  - `supabase/functions/compress-image/index.ts` & `deno.json`: Deno 2 runtime entrypoint with isolate-cached CORS/Supabase clients, `||` env fallbacks, `res.ok` WASM load check, `@imagemagick/magick-wasm` `ResourceLimits` (8192 px max side, 32M area, 64 MiB memory, 0 disk, 1 frame, 15s time), explicit `MagickFormat`, `autoOrient`, `strip`, downscale-only `resize`, and `MagickFormat.WebP`.
- **Mobile App (root):**
  - `package.json` / `package-lock.json`: Add `expo-image-manipulator@^58.0.16` and append `tests/api/org-media-storage.sql` to `db:test`.
  - `jest.config.js`: Include `supabase/functions/compress-image/core.ts` in `collectCoverageFrom`.
  - `src/theme/ccsCrest.ts`: CCS Crest palette tokens from `DESIGN.md`.
  - `src/services/mediaUpload.ts`: On-device `expo-image-manipulator` pre-compression (`ImageManipulator.manipulate` + `SaveFormat.WEBP`) and authenticated `POST /functions/v1/compress-image` multipart upload client.
  - `src/services/deptOrg.ts`: Typed Supabase read/write service for `department_info`, `organizations`, `org_memberships`, and `announcements` validated through `shared/core-schema.ts`.
  - `src/components/DepartmentAboutView.tsx`, `src/components/AnnouncementsFeedView.tsx`, `src/components/OrgDirectoryView.tsx`, `src/components/OrgDetailView.tsx`, `src/screens/MyCcsHubScreen.tsx`.
  - `src/screens/AuthIdentityScreen.tsx` & `App.tsx`: Optional `renderAuthenticated` prop on `AuthIdentityScreen` wired by `App.tsx` to mount `MyCcsHubScreen` while preserving `<IdentityCard>` as default fallback.
- **Tests (`tests/`):**
  - `tests/api/compress-image.postman_collection.json`: Newman API test collection for JWT, role, cross-org, MIME/spoofing, >5 MiB rejection, and happy-path WebP responses.
  - `tests/api/org-media-storage.sql`: Rolled-back SQL verification of `org-media` bucket bounds and blocked direct client writes.
  - `tests/unit/compress-image.test.ts`: Jest unit tests for `shared/media-upload.ts`, `supabase/functions/compress-image/core.ts`, migration SQL, and Postman collection integrity.
  - `tests/unit/dept-org-pages.test.ts`: Jest unit/component tests for `shared/dept-org.ts`, `src/services/mediaUpload.ts`, `src/services/deptOrg.ts`, and `MyCcsHubScreen` views across `student`, `officer`, and `admin` roles.

## Database Schema, RLS, Grants & Encryption

- No new `public` tables are created. Existing `public.department_info`, `public.organizations`, `public.org_memberships`, and `public.announcements` RLS policies and triggers from `spec-02` remain intact, while `public.organizations` adds the `trg_organizations_guard_media_urls` trigger (`public.guard_organizations_media_urls()`) blocking direct non-NULL `authenticated` writes to `logo_url`/`cover_url` and verifying `storage.objects` existence when `compress-image` persists media URLs via `service_role`.
- Storage bucket `org-media`:
  - `public = true` so React Native `<Image>` renders normalized WebP assets by HTTPS URL stored in `organizations.logo_url` and `organizations.cover_url`.
  - `file_size_limit = 5242880` (5 MiB) and `allowed_mime_types = ARRAY['image/webp']`.
  - `storage.objects` receives a read-only `SELECT` policy for active `authenticated` users (`bucket_id = 'org-media' AND public.is_active_profile()`) and zero `INSERT`, `UPDATE`, or `DELETE` policies for `anon` or `authenticated`. All writes run strictly through `compress-image` using the Supabase secret/service-role key after JWT and RBAC verification.
- Zero PII is placed in Storage object paths (`orgs/<org_uuid>/<kind>/<asset_uuid>.webp`) or image metadata (all EXIF/GPS/XMP stripped).

## Core Data Shapes

```ts
export type MediaKind = 'logo' | 'cover' | 'flyer';
export type AllowedInputImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export type MediaValidationResult =
  | { ok: true; mimeType: AllowedInputImageMime }
  | {
      ok: false;
      code: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_MIME' | 'MIME_MISMATCH';
      status: 400 | 413 | 415;
      message: string;
    };

export type MobileHubRoute =
  | { tab: 'feed' }
  | { tab: 'department'; mode: 'view' | 'edit' }
  | {
      tab: 'orgs';
      view:
        | { kind: 'directory' }
        | { kind: 'detail'; orgId: string; panel: 'posts' | 'edit_org' | 'new_post' };
    }
  | { tab: 'identity' };
```

## Decisions

1. **Split `compress-image` into Pure `core.ts` + Deno 2 `index.ts` Entrypoint**
   - *Decision:* Keep request routing, JWT claim checks (`aud`/`iss`), magic-byte validation, RBAC authorization, and response formatting in `core.ts` with injected dependencies (`verifyUser`, `loadAuthorizationContext`, `processImage`, `uploadWebp`), and keep `index.ts` as a thin Deno 2 adapter using `@supabase/supabase-js` and `@imagemagick/magick-wasm`.
   - *Rationale:* Lets Jest exercise the real production HTTP handler directly in CI without requiring a live Deno daemon, while `index.ts` stays minimal and uses Supabase's documented WASM image processor (`@imagemagick/magick-wasm`).
   - *Alternative Considered:* Inline `Deno.serve` + `magick-wasm` in a single `index.ts` file — rejected because Jest cannot import `npm:` specifiers and coverage on security branches would drop to string-matching proxies.

2. **Service-Role-Only Writes to `org-media` Bucket**
   - *Decision:* Create `org-media` with `allowed_mime_types = ARRAY['image/webp']`, `file_size_limit = 5242880`, and zero client `INSERT`/`UPDATE`/`DELETE` RLS policies on `storage.objects`.
   - *Rationale:* Prevents any authenticated client from bypassing EXIF stripping or uploading spoofed files directly to Storage.
   - *Alternative Considered:* Allowing officers to upload directly to Storage and running an async webhook to strip EXIF — rejected because raw EXIF/GPS data would briefly exist in a public bucket (`ADR-007` violation).

3. **Zero-Router Discriminated `MobileHubRoute` State in `MyCcsHubScreen`**
   - *Decision:* Model tab and sub-view navigation with `MobileHubRoute` inside `MyCcsHubScreen` and mount it via `AuthIdentityScreen`'s optional `renderAuthenticated` prop in `App.tsx`.
   - *Rationale:* Avoids adding Expo Router migration churn across `spec-01` tests while keeping illegal UI states unrepresentable and keeping `AuthIdentityScreen` backward-compatible.
   - *Alternative Considered:* Migrating the root Expo entry to `expo-router` file-based routing now — deferred because `spec-04` only needs 4 tabs and migrating root entrypoints would widen blast radius beyond the smallest complete slice.

## Risks / Trade-offs

- **[Read-Only Org Posts]** → `shortcut: Org pages render read-only chronological posts with no likes, comments, or drag-and-drop builder; upgrade in Phase 2 if orgs request interactive discussions`.
- **[Browser CORS vs Native Mobile Requests on `compress-image`]** → Native Expo mobile clients omit the `Origin` header, while browsers always send `Origin`. `compress-image` allows requests with no `Origin` header (omitting `Access-Control-Allow-Origin`) and rejects browser requests from disallowed origins with `403` (enforcing fail-closed CORS for `web-admin/`).
- **[Newman Live Execution in CI]** → CI `Phase 3 · Newman API Tests` remains a stub until `spec-08-qa-security-release`; `tests/unit/compress-image.test.ts` runs real HTTP handler tests for every rejection and success branch in Jest today while `tests/api/compress-image.postman_collection.json` is ready for Newman execution against local/staging Supabase.

## Migration Plan

1. Commit `shared/`, `supabase/migrations/20261127000001_spec04_org_media_storage.sql`, `supabase/config.toml`, `supabase/functions/compress-image/`, `src/`, `App.tsx`, `package.json`, `jest.config.js`, and `tests/` atomically in the `SCRUM-13` PR targeting `develop`.
2. Rollback drops `trg_organizations_guard_media_urls` from `public.organizations` before dropping `public.guard_organizations_media_urls()`, performs both drops before reverting the PR and restoring previous clients, and then drops the `org-media` Storage read policy/bucket if unused.
