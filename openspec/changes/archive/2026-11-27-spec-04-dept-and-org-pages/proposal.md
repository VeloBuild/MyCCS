# Proposal: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`)

- **Jira Reference:** `SCRUM-13`
- **Roadmap Spec:** `spec-04-dept-and-org-pages` (Milestone 2, Org Hub, Media & GMetrix Distribution, `openspec/ROADMAP.md`)
- **Owning Requirements:** `FR-DEPT` (`FR-DEPT-01`, `FR-DEPT-02`), `FR-ORG` (`FR-ORG-01`, `FR-ORG-02`), `SAB §7.3`, `ADR-007`

## Why

MyCCS has verified `@lpunetwork.edu.ph` authentication (`spec-01`), core tables with 3-role RBAC RLS (`spec-02`), and the isolated `web-admin/` guard (`spec-03`), but signed-in mobile users only see their identity card. Implementing the Department About screen, Announcements feed, Main Org and Sub-Org directory and simplified org pages, and the on-device plus server-side image compression pipeline delivers the Milestone 2 community hub while enforcing RA 10173 EXIF stripping and role boundaries on media uploads.

## What Changes

- Add shared domain and media-upload contracts in `shared/media-upload.ts` and `shared/dept-org.ts` (re-exported via `shared/index.ts`), covering the 5 MiB upload cap, JPEG/PNG/WebP magic-byte verification, WebP storage path builders, organization hierarchy tree grouping, announcement feed filtering with `expires_at`, and a discriminated `MobileHubRoute` union.
- Add a Supabase Storage migration (`supabase/migrations/20261127000001_spec04_org_media_storage.sql`) provisioning the `org-media` bucket (5 MiB limit, `image/webp` only) with zero direct `INSERT`/`UPDATE`/`DELETE` policies for `anon` or `authenticated` so all media writes must pass through `compress-image`.
- Implement `POST /functions/v1/compress-image` (`supabase/functions/compress-image/core.ts`, `index.ts`, `deno.json`) validating caller JWT (`aud`, `iss`, and `auth.getUser`), enforcing server-side `admin` or assigned active `officer` authorization, verifying magic bytes and the 5 MiB limit, stripping EXIF metadata and converting to WebP with `@imagemagick/magick-wasm`, and uploading to `org-media` via the service role.
- Add on-device pre-compression (`expo-image-manipulator`) and authenticated upload service (`src/services/mediaUpload.ts`) plus data access services (`src/services/deptOrg.ts`) for `department_info`, `organizations`, `org_memberships`, and `announcements`.
- Build the authenticated CCS Crest mobile hub (`src/screens/MyCcsHubScreen.tsx`, `src/components/DepartmentAboutView.tsx`, `src/components/AnnouncementsFeedView.tsx`, `src/components/OrgDirectoryView.tsx`, `src/components/OrgDetailView.tsx`, `src/theme/ccsCrest.ts`) and wire it into `App.tsx` via `AuthIdentityScreen` without breaking standalone auth card rendering.
- Add Postman/Newman tests (`tests/api/compress-image.postman_collection.json`), Storage SQL RLS tests (`tests/api/org-media-storage.sql`), and Jest unit/component suites (`tests/unit/compress-image.test.ts`, `tests/unit/dept-org-pages.test.ts`).

## Capabilities

### New Capabilities
- `dept-and-org-pages`: Authenticated Department About view and admin editor, expiration-aware department and organization announcements feed, Main Org to Sub-Org directory and read-only simplified org pages (cover, logo, details, chronological posts), and on-device plus Edge Function (`compress-image`) EXIF-stripping WebP media upload pipeline.

### Modified Capabilities
None. `auth-identity`, `core-schema-rls`, and `web-admin-scaffold` requirements remain unchanged.

## Out of Scope

Per the MVP cutline (`docs/jira/PRD_MyCCS.md` §6) and roadmap sequencing:
- Social engagement on org posts (likes, comments, reactions, student-to-student chat) and drag-and-drop page builders.
- Conditional membership application forms and officer approve/reject review workflows (`spec-07-conditional-forms-metrics`).
- GMetrix CSV upload, `import-gmetrix-keys`, and content-free Expo Push notifications (`spec-05-gmetrix-csv-and-push`).
- Events, flyers UI, and offline QR scanning (`spec-06-events-and-offline-qr`).

## Impact

- **Shared Contracts (`shared/`):** New `shared/media-upload.ts`, `shared/dept-org.ts`; updated `shared/index.ts`.
- **Backend (`supabase/`):** New `supabase/migrations/20261127000001_spec04_org_media_storage.sql`, `supabase/functions/compress-image/{core.ts,index.ts,deno.json}`; updated `supabase/config.toml`.
- **Mobile App (root):** New `expo-image-manipulator` dependency, `src/theme/ccsCrest.ts`, `src/services/{deptOrg,mediaUpload}.ts`, `src/screens/MyCcsHubScreen.tsx`, `src/components/{DepartmentAboutView,AnnouncementsFeedView,OrgDirectoryView,OrgDetailView}.tsx`; updated `App.tsx`, `src/screens/AuthIdentityScreen.tsx`, `package.json`, `jest.config.js`.
- **Tests (`tests/`):** New `tests/api/compress-image.postman_collection.json`, `tests/api/org-media-storage.sql`, `tests/unit/compress-image.test.ts`, `tests/unit/dept-org-pages.test.ts`.
