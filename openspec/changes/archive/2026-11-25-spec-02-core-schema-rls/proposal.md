# Proposal: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)

- **Jira Reference:** `SCRUM-11`
- **Roadmap Spec:** `spec-02-core-schema-rls` (Milestone 1 — Foundation, Auth & Security, `openspec/ROADMAP.md`)
- **Owning Requirements:** `FR-DEPT` (`FR-DEPT-01`, `FR-DEPT-02`), `FR-ORG` (`FR-ORG-01`, `FR-ORG-02`, `FR-ORG-03`), `SAB §5–§6`, `ADR-005`

## Why

With institutional auth and encrypted `profiles` landed in `spec-01-auth-identity`, MyCCS needs the foundational relational tables for department information, two-tier student organizations (Main Org -> Sub-Org), organization memberships, and announcements, protected by strict 3-role RBAC (`student | officer | admin`) RLS policies and explicit `GRANT`s. Landing this schema and authorization boundary now unblocks `spec-03-web-admin-scaffold`, `spec-04-dept-and-org-pages`, and all downstream org-scoped features without duplicating authorization logic.

## What Changes

- Add PostgreSQL migration `supabase/migrations/20261125000001_spec02_core_schema_rls.sql` creating `public.department_info`, `public.organizations` (with self-referencing `parent_org_id` for Main Org -> Sub-Org 2-tier hierarchy), `public.org_memberships`, and `public.announcements` (with `global_visibility`, `published_at`, `expires_at`, and `deleted_at`).
- Add anti-recursion `SECURITY DEFINER` RLS helper functions (`public.is_org_officer(uuid)`, `public.is_org_member(uuid)`) and integrity triggers (`guard_organizations_hierarchy`, `guard_org_memberships_mutation`) to prevent 3-level nesting, role self-escalation, and unauthorized soft-deletes.
- Enable and force Row Level Security (`ENABLE` + `FORCE`) with explicit `GRANT` / `REVOKE` statements for `authenticated` and zero table privileges for `anon` across all four tables.
- Add `shared/core-schema.ts` with Zod schemas, inferred TypeScript DTOs, and pure RBAC capability helpers matching the PostgreSQL RLS matrix.
- Add focused verification suites: Jest unit tests (`tests/unit/core-schema.test.ts`), rolled-back PostgreSQL RLS/grant contract tests (`tests/api/core-schema-rls.sql`), and a Newman/Postman RLS collection (`tests/api/core-schema-rls.postman_collection.json`).

## Capabilities

### New Capabilities
- `core-schema-rls`: Core relational schema (`department_info`, `organizations`, `org_memberships`, `announcements`), two-tier Main Org -> Sub-Org hierarchy enforcement, 3-role RBAC (`student | officer | admin`) Row Level Security with explicit `GRANT`s, shared Zod contracts, and per-role positive/negative RLS verification.

### Modified Capabilities
None — `auth-identity` requirements from `spec-01` are unchanged; this change reuses `public.profiles`, `public.is_admin()`, and `public.current_user_role()`.

## Out of Scope

Per the MVP cutline (`docs/jira/PRD_MyCCS.md` §6) and roadmap sequencing:
- Mobile UI screens for Department About, Org pages, and Announcements feed (`spec-04-dept-and-org-pages`).
- Image compression Edge Function (`compress-image`) and Storage bucket uploads (`spec-04-dept-and-org-pages`).
- Standalone `web-admin/` Vite SPA scaffold (`spec-03-web-admin-scaffold`).
- Conditional membership application form builder and `form_submissions` FK constraint (`spec-07-conditional-forms-metrics`).
- Social engagement features (likes, comments, chat), events/attendance (`spec-06`), and GMetrix key distribution (`spec-05`).

## Impact

- **Backend (`supabase/`):** New SQL migration `supabase/migrations/20261125000001_spec02_core_schema_rls.sql`.
- **Shared Contracts (`shared/`):** New `shared/core-schema.ts` (Zod schemas, types, pure RBAC helpers).
- **Tests (`tests/`):** New `tests/unit/core-schema.test.ts`, `tests/api/core-schema-rls.sql`, and `tests/api/core-schema-rls.postman_collection.json`.
- **Untouched:** Root mobile UI screens (`src/`, `App.tsx`), `web-admin/`, and `supabase/functions/`.
