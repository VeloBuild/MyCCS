# Tasks: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`)

- **Jira Reference:** `SCRUM-13`
- **Spec:** [specs/dept-and-org-pages/spec.md](./specs/dept-and-org-pages/spec.md)
- **Design:** [design.md](./design.md)

## 1. Shared Media & Department/Org Contracts (`shared/`)

- [x] 1.1 Create `shared/media-upload.ts` (`MAX_MEDIA_UPLOAD_BYTES`, `MEDIA_STORAGE_BUCKET`, `MEDIA_VARIANT_LIMITS`, `MediaKindSchema`, `CompressImageRequestMetaSchema`, `CompressImageResponseSchema`, `detectImageMimeFromMagicBytes`, `validateUploadPayload`, `buildMediaStoragePath`, `canUploadOrgMedia`), `shared/dept-org.ts` (`MobileHubRoute`, `buildOrganizationTree`, `filterAnnouncementsFeed`, `getOrganizationPosts`, `isAnnouncementExpired`, `normalizeDepartmentContacts`), and re-export both from `shared/index.ts`; verify with `npx tsc --noEmit`.

## 2. Storage Bucket Migration, `compress-image` Edge Function & Newman API Tests (`supabase/`, `tests/api/`)

- [x] 2.1 Create `supabase/migrations/20261127000001_spec04_org_media_storage.sql` provisioning the `org-media` bucket (5 MiB limit, `image/webp` only, zero client write policies) and update `supabase/config.toml` (`[storage.buckets.org-media]` and `[functions.compress-image] verify_jwt = false`); add `tests/api/org-media-storage.sql` and wire it into `package.json` `db:test`; verify migration and SQL assertions in `tests/unit/compress-image.test.ts`.
- [x] 2.2 Implement `supabase/functions/compress-image/core.ts`, `supabase/functions/compress-image/index.ts` (`@imagemagick/magick-wasm` EXIF strip + resize + WebP conversion), and `supabase/functions/compress-image/deno.json`; add `tests/api/compress-image.postman_collection.json` (JWT, role, cross-org, MIME/magic-byte, >5 MiB, and valid WebP checks) and Jest tests in `tests/unit/compress-image.test.ts`; verify `npm test -- tests/unit/compress-image.test.ts` passes.

## 3. On-Device Pre-Compression & Mobile Dept/Org Hub (`src/`, `App.tsx`)

- [x] 3.1 Implement `src/theme/ccsCrest.ts`, `src/services/mediaUpload.ts` (`expo-image-manipulator` WebP pre-compression + `POST /functions/v1/compress-image` multipart upload), and `src/services/deptOrg.ts` (typed Supabase CRUD for `department_info`, `organizations`, `org_memberships`, and `announcements`); verify with `npx tsc --noEmit` and focused service unit tests in `tests/unit/dept-org-pages.test.ts`.
- [x] 3.2 Implement `src/components/DepartmentAboutView.tsx`, `src/components/AnnouncementsFeedView.tsx`, `src/components/OrgDirectoryView.tsx`, `src/components/OrgDetailView.tsx`, and `src/screens/MyCcsHubScreen.tsx`, and wire `App.tsx` + `src/screens/AuthIdentityScreen.tsx`; verify student/officer/admin UI flows and read-only post constraints in `tests/unit/dept-org-pages.test.ts` (`npm test -- tests/unit/dept-org-pages.test.ts`).

## 4. Verification, Audits & Coverage Gates

- [x] 4.1 Run full verification gates (`npx tsc --noEmit`, `npm test -- --coverage --ci` with >= 80/75/80/80 thresholds, `openspec validate spec-04-dept-and-org-pages --strict`, `openspec-verify-change`), execute `ponytail-audit` and `no-comments` review, apply accepted fixes, and re-verify green.

## Workflow follow-up

- Archive `spec-04-dept-and-org-pages` via `openspec-archive-change` (sync main spec to `openspec/specs/dept-and-org-pages/spec.md`), check off `spec-04-dept-and-org-pages` and log any bugs/shortcuts in `openspec/ROADMAP.md`, and run `graphify update .`.
- Push `feat/SCRUM-13-spec-04-dept-and-org-pages`, open PR targeting `develop`, verify CI green, run `coderabbit-pr-gate` (`--wait`), apply valid CodeRabbit findings until all checks are green, and Squash & Merge into `develop`.
