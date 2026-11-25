# Tasks: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)

- **Jira Reference:** `SCRUM-11`
- **Spec:** [specs/core-schema-rls/spec.md](./specs/core-schema-rls/spec.md)
- **Design:** [design.md](./design.md)

## 1. Shared Core Schema Contracts & RBAC Helpers (`shared/`)

- [x] 1.1 Create `shared/core-schema.ts` with Zod schemas (`DepartmentInfoSchema`, `OrganizationSchema`, `OrgMembershipRoleSchema`, `OrgMembershipStatusSchema`, `OrgMembershipSchema`, `AnnouncementSchema`) and pure RBAC helper functions (`canManageDepartmentInfo`, `canManageOrganization`, `canReviewMembership`, `canPublishAnnouncement`, `isAnnouncementVisibleTo`) mirroring the SQL RLS matrix; verify with `tests/unit/core-schema.test.ts` (`npm test -- tests/unit/core-schema.test.ts` and `npx tsc --noEmit`).

## 2. Core Schema Migration, 3-Role RBAC RLS & Explicit `GRANT`s (`supabase/`)

- [x] 2.1 Create migration `supabase/migrations/20261125000001_spec02_core_schema_rls.sql` defining `public.department_info`, `public.organizations` (2-tier `parent_org_id` + active-name unique index + soft delete), `public.org_memberships` (`UNIQUE(profile_id, organization_id)` + `shortcut:` note for `submission_id` FK), `public.announcements` (`global_visibility`, `published_at`, `expires_at`, `deleted_at`), anti-recursion helpers (`is_active_profile`, `is_org_officer`, `is_org_member`), `SECURITY INVOKER` mutation guard triggers, `ENABLE`/`FORCE ROW LEVEL SECURITY`, 3-role RLS policies, and explicit `GRANT`/`REVOKE` statements; verify via structural/policy assertions in `tests/api/core-schema-rls.sql` and Jest migration-contract checks.

## 3. Per-Role RLS Contract & Newman Verification Suites (`tests/api/`)

- [x] 3.1 Create rolled-back PostgreSQL RLS/grant verification script `tests/api/core-schema-rls.sql` testing `anon`, `student`, `officer` (Org A vs Org B), and `admin` positive/negative access, 3-level nesting rejection, role escalation blocking, and expired/soft-deleted announcement filtering; verify syntax and completeness against migration objects.
- [x] 3.2 Create Postman/Newman collection `tests/api/core-schema-rls.postman_collection.json` covering positive and negative PostgREST calls per role (`anon`, `student`, `officer`, `admin`) across all four tables; verify JSON structure and collection assertions via Jest schema/collection validation in `tests/unit/core-schema.test.ts`.

## 4. Integration Verification, Ponytail Audit & Local Gates

- [x] 4.1 Run `npx tsc --noEmit`, `npm test -- --coverage --ci` (meeting `80/75/80/80` thresholds), `openspec validate spec-02-core-schema-rls --strict`, and `ponytail-audit`; apply all audit findings and re-verify green.

## Workflow follow-up

- Archive `spec-02-core-schema-rls` once implementation and audit fixes pass (`openspec archive`), check off `spec-02-core-schema-rls` and record `submission_id` shortcut in `openspec/ROADMAP.md`, and run `graphify update .`.
- Push `feat/SCRUM-11-spec-02-core-schema-rls`, open PR targeting `develop`, wait for CI Phases 1–3 green, and Squash & Merge.
