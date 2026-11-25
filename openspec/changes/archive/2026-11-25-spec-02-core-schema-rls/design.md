# Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)

- **Jira Reference:** `SCRUM-11`
- **Roadmap Spec:** `spec-02-core-schema-rls` (`openspec/ROADMAP.md`)
- **Related Specs:** [proposal.md](./proposal.md), [specs/core-schema-rls/spec.md](./specs/core-schema-rls/spec.md)
- **Authoritative Architecture:** `docs/jira/Software_Architecture_Baseline.md` (§5, §6.1, §6.2, `ADR-005`)

## Context

See `proposal.md` for motivation (`FR-DEPT`, `FR-ORG`, `ADR-005`). `spec-01-auth-identity` already established `public.profiles` (`id`, `role`, `deleted_at`) along with anti-recursion helpers `public.current_user_role()` and `public.is_admin()`. Because `auto_expose_new_tables` is unset in `supabase/config.toml`, every new `public` table MUST enable + force RLS and issue explicit `GRANT` statements for `authenticated` while revoking all privileges from `PUBLIC` and `anon`.

## Goals / Non-Goals

**Goals:**
- Create `public.department_info`, `public.organizations`, `public.org_memberships`, and `public.announcements` matching SAB §6.2.
- Enforce the two-tier org hierarchy (`Main Org -> Sub-Org`, no 3-level nesting or cycles) and soft-delete semantics (`deleted_at`) in PostgreSQL.
- Consolidate org-scoped RBAC checks behind `SECURITY DEFINER` anti-recursion helpers (`public.is_org_officer(uuid)`, `public.is_org_member(uuid)`).
- Provide shared Zod schemas and pure RBAC capability helpers in `shared/core-schema.ts`.
- Provide Jest unit tests, rolled-back SQL RLS contract tests, and a Newman/Postman RLS collection covering positive and negative cases for `anon`, `student`, `officer`, and `admin`.

**Non-Goals:**
- Mobile UI screens (`spec-04-dept-and-org-pages`) or `web-admin/` scaffold (`spec-03-web-admin-scaffold`).
- Foreign key from `org_memberships.submission_id` to `public.form_submissions` (`spec-07-conditional-forms-metrics`).

## Surfaces Touched

- **`supabase/migrations/20261125000001_spec02_core_schema_rls.sql`**: Tables, indexes, constraints, anti-recursion helpers, integrity triggers, RLS policies, and explicit `GRANT`s.
- **`shared/core-schema.ts`**: Zod schemas, inferred DTOs, and pure RBAC helper functions mirroring SQL RLS rules.
- **`tests/unit/core-schema.test.ts`**: Jest unit tests for `shared/core-schema.ts`.
- **`tests/api/core-schema-rls.sql`**: Rolled-back PostgreSQL RLS + `GRANT` verification script.
- **`tests/api/core-schema-rls.postman_collection.json`**: Newman/Postman collection for per-role PostgREST positive/negative RLS checks.
- **Untouched:** Root mobile screens (`src/`, `App.tsx`), `web-admin/`, `supabase/functions/`.

## Database Schema, RLS, Grants & Encryption

No new PII columns are introduced in these four tables (`department_info`, `organizations`, `org_memberships`, `announcements` reference `profiles.id` UUIDs only; all student PII remains encrypted in `public.profiles`).

### 1. Anti-Recursion RBAC Helpers (`SECURITY DEFINER`, `STABLE`, `SET search_path = public`)
- `public.is_active_profile() returns boolean`: caller exists in `public.profiles` with `deleted_at IS NULL`.
- `public.is_org_officer(p_org_id uuid) returns boolean`: `public.is_active_profile()` AND exists an `approved` `officer` row in `public.org_memberships` for `(auth.uid(), p_org_id)` AND the organization has `deleted_at IS NULL`.
- `public.is_org_member(p_org_id uuid) returns boolean`: `public.is_active_profile()` AND exists an `approved` (`member` or `officer`) row in `public.org_memberships` for `(auth.uid(), p_org_id)` AND the organization has `deleted_at IS NULL`.
- Privileges: `REVOKE ALL` from `PUBLIC, anon`; `GRANT EXECUTE` to `authenticated`.

### 2. Tables, Triggers & Explicit `GRANT`s
All four tables run `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, `REVOKE ALL ... FROM PUBLIC, anon, authenticated;`, and `GRANT USAGE ON SCHEMA public TO authenticated;`.

| Table | `authenticated` Grants | Key Constraints / Triggers |
| :--- | :--- | :--- |
| `public.department_info` | `SELECT, INSERT, UPDATE, DELETE` | `leadership_json` array check, `contact_json` object check, `updated_at` trigger. Writes restricted to `is_admin()`. |
| `public.organizations` | `SELECT, INSERT, UPDATE` (no hard `DELETE`) | `parent_org_id <> id`, `logo_url`/`cover_url` `^https?://` checks, unique active `(COALESCE(parent_org_id, nil_uuid), lower(btrim(name)))`, `guard_organizations_hierarchy` trigger (blocks 3-level nesting with `FOR SHARE` parent lock, deleted parents, soft-deleting or demoting a Main Org with active Sub-Orgs, and non-admin changes to `parent_org_id`/`deleted_at`). |
| `public.org_memberships` | `SELECT, INSERT, UPDATE, DELETE` | `UNIQUE (profile_id, organization_id)`, `role IN ('member','officer')`, `status IN ('pending','approved','rejected')`, `submission_id uuid NULL` (`shortcut:` FK deferred to `spec-07`), `guard_org_memberships_mutation` trigger (blocks non-admin `officer` role assignment and student/officer immutable column tampering). |
| `public.announcements` | `SELECT, INSERT, UPDATE` (no hard `DELETE`) | `expires_at IS NULL OR expires_at > published_at`, `organization_id IS NOT NULL OR global_visibility = true`, `guard_announcements_mutation` trigger (blocks non-admin `organization_id` reassignment, `NEW.global_visibility = true`, or mutating `OLD.global_visibility = true`). |

### 3. RLS Policy Matrix
- **`department_info`**: `SELECT` for `is_active_profile()`; `INSERT`/`UPDATE`/`DELETE` for `is_admin()`.
- **`organizations`**: `SELECT` for `is_admin() OR (is_active_profile() AND deleted_at IS NULL)` (allows admin soft-delete with `RETURNING` and restore while hiding soft-deleted rows from students/officers); `INSERT` for `is_admin()`; `UPDATE` for `is_admin() OR (is_org_officer(id) AND deleted_at IS NULL)`.
- **`org_memberships`**:
  - `SELECT`: `is_active_profile() AND (profile_id = auth.uid() OR is_org_officer(organization_id) OR is_admin())`.
  - `INSERT`: `is_admin()` OR (`is_active_profile() AND profile_id = auth.uid() AND role = 'member' AND status = 'pending'` against an active org).
  - `UPDATE`: `is_admin()` OR (`is_org_officer(organization_id)` with `USING (role = 'member')` and `WITH CHECK (role = 'member')`).
  - `DELETE`: `is_admin()` OR (`is_active_profile() AND profile_id = auth.uid() AND status = 'pending'`).
- **`announcements`**:
  - `SELECT`: `is_admin() OR (organization_id IS NOT NULL AND is_org_officer(organization_id)) OR (deleted_at IS NULL AND is_active_profile() AND (expires_at IS NULL OR expires_at > now()) AND (global_visibility = true OR (organization_id IS NOT NULL AND is_org_member(organization_id))))` (allows admins/officers soft-delete with `RETURNING` and admin restore while students/members never see soft-deleted or expired rows).
  - `INSERT`: `is_admin()` OR (`organization_id IS NOT NULL AND is_org_officer(organization_id) AND global_visibility = false AND deleted_at IS NULL`).
  - `UPDATE`: `is_admin()` OR (`organization_id IS NOT NULL AND is_org_officer(organization_id) AND global_visibility = false AND deleted_at IS NULL` with `WITH CHECK (organization_id IS NOT NULL AND is_org_officer(organization_id) AND global_visibility = false)`).

## Decisions

1. **Consolidated `SECURITY DEFINER` Org Helpers vs Inline RLS Subqueries**
   - *Decision:* Use `public.is_active_profile()`, `public.is_org_officer(uuid)`, and `public.is_org_member(uuid)` (`SECURITY DEFINER`, `STABLE`, `SET search_path = public`).
   - *Rationale:* Prevents PostgreSQL RLS infinite recursion (`42P17`) when `org_memberships` policies query `org_memberships` to check officer status, and keeps soft-delete checks in one place.
   - *Alternative Considered:* Inline `EXISTS` subqueries in every policy — rejected due to `42P17` recursion on `org_memberships` and duplicated predicates across tables.

2. **`SECURITY INVOKER` Mutation Guard Triggers Alongside RLS**
   - *Decision:* Pair RLS policies with `SECURITY INVOKER` `BEFORE INSERT/UPDATE` triggers (`guard_organizations_hierarchy`, `guard_org_memberships_mutation`, `guard_announcements_mutation`) following `spec-01`'s `guard_profiles_immutable_columns` pattern.
   - *Rationale:* RLS `WITH CHECK` cannot compare `NEW` vs `OLD` column immutability (e.g., blocking an officer from setting `organizations.deleted_at` or changing `parent_org_id`). Using `SECURITY INVOKER` avoids `BUG-011` (`current_user` always `postgres` in `SECURITY DEFINER` triggers).

## Risks / Trade-offs

- **[`org_memberships.submission_id` Unconstrained Until `spec-07`]** → Kept nullable `uuid` with a `shortcut:` comment; `spec-07-conditional-forms-metrics` will add `FOREIGN KEY (submission_id) REFERENCES public.form_submissions(id) ON DELETE SET NULL`.
- **[Local Docker Unavailable for Live Postgres Execution]** → `tests/api/core-schema-rls.sql` and `tests/api/core-schema-rls.postman_collection.json` are authored as executable verification artifacts runnable in staging/CI once Supabase/Newman is wired (`spec-08`), complemented by Jest unit tests covering all shared contracts and RBAC logic locally today.

## Migration Plan

1. Commit `supabase/migrations/20261125000001_spec02_core_schema_rls.sql`, `shared/core-schema.ts`, and `tests/` atomically in the same `SCRUM-11` PR.
2. Rollback cleanly drops the four net-new tables and helper functions without affecting `spec-01`'s `public.profiles`.
