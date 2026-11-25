# core-schema-rls Specification

## Purpose

Defines the relational data model and 3-role RBAC (`student | officer | admin`) Row Level Security boundaries for CCS department information (`FR-DEPT-01`), two-tier student organizations (`FR-ORG-01`, `FR-ORG-02`), organization memberships (`FR-ORG-03`), and announcements (`FR-DEPT-02`).

## Requirements

### Requirement: Department Information Storage & Admin-Only Governance (`FR-DEPT-01`)
The system MUST store CCS department profile content (`title`, `about_markdown`, `leadership_json`, `contact_json`, `updated_at`) readable by all authenticated users and writable exclusively by `admin` users.

#### Scenario: Authenticated student reads department information
- **WHEN** an authenticated `student` or `officer` queries `department_info`
- **THEN** the database returns the department record

#### Scenario: Non-admin attempts to modify department information
- **WHEN** an authenticated `student` or `officer` attempts to insert, update, or delete `department_info`
- **THEN** Row Level Security rejects the write

#### Scenario: Admin updates department information
- **WHEN** an authenticated `admin` inserts or updates `department_info`
- **THEN** the write succeeds and refreshes `updated_at`

### Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`)
The system MUST store organizations in a strict two-tier hierarchy (`parent_org_id IS NULL` for Main Organizations, `parent_org_id` referencing a Main Organization for Sub-Organizations) with soft deletes (`deleted_at`), admin-only creation, and scoped officer customization.

#### Scenario: Creating a Sub-Organization under a Main Organization
- **WHEN** an `admin` creates an organization whose `parent_org_id` references an active Main Organization (`parent_org_id IS NULL`)
- **THEN** the Sub-Organization is created and visible to authenticated users

#### Scenario: Rejecting three-level nesting or self-parenting
- **WHEN** a write sets `parent_org_id` to itself or to an existing Sub-Organization
- **THEN** the database rejects the write with a check or hierarchy constraint error

#### Scenario: Assigned officer customizes their organization page
- **WHEN** an approved `officer` of an active organization updates its `name`, `details`, `logo_url`, or `cover_url`
- **THEN** the update succeeds while `parent_org_id` and `deleted_at` remain immutable for non-admins

#### Scenario: Officer attempts to edit another organization
- **WHEN** an `officer` of Organization A attempts to update Organization B
- **THEN** Row Level Security rejects the update

### Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`)
The system MUST allow students to apply to join organizations as pending members, allow host-organization officers to review member applications without granting officer roles, and reserve officer role assignment for `admin` users.

#### Scenario: Student submits a pending membership application
- **WHEN** an authenticated `student` inserts an `org_memberships` row for themselves with `role = 'member'` and `status = 'pending'` against an active organization
- **THEN** the application is created and visible to the student, that organization's officers, and admins

#### Scenario: Student attempts to self-approve or claim officer role
- **WHEN** an authenticated `student` attempts to insert or update their membership with `status = 'approved'` or `role = 'officer'`
- **THEN** Row Level Security or the membership guard trigger rejects the write

#### Scenario: Organization officer approves a member application
- **WHEN** an approved `officer` of Organization A updates a pending `member` row for Organization A to `approved` or `rejected`
- **THEN** the status change succeeds while `role` remains `'member'`

#### Scenario: Organization officer attempts to promote a member to officer
- **WHEN** an `officer` attempts to set `role = 'officer'` on any `org_memberships` row
- **THEN** the database rejects the privilege escalation

### Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`)
The system MUST support department-wide announcements (`organization_id IS NULL`, `global_visibility = true`, admin-only) and organization-scoped announcements (`organization_id IS NOT NULL`, `global_visibility = false`, managed by host-org officers or admins) with optional `expires_at` and soft deletes (`deleted_at`).

#### Scenario: Student reads active global and joined-organization announcements
- **WHEN** an authenticated `student` queries `announcements`
- **THEN** only non-deleted, non-expired announcements that are global or belong to organizations where the student has an `approved` membership are returned

#### Scenario: Officer publishes an announcement for their assigned organization
- **WHEN** an approved `officer` of Organization A inserts a non-global announcement for Organization A
- **THEN** the announcement is created and visible to approved members of Organization A

#### Scenario: Officer attempts to publish a department-wide or cross-org announcement
- **WHEN** an `officer` of Organization A attempts to insert an announcement with `global_visibility = true`, `organization_id IS NULL`, or `organization_id = Organization B`
- **THEN** Row Level Security rejects the insert

### Requirement: Mandatory Row Level Security & Explicit Grants (`ADR-005`)
Every table introduced in `core-schema-rls` MUST enable and force Row Level Security, grant zero privileges to `anon` and `PUBLIC`, and declare explicit least-privilege `GRANT` statements for `authenticated`.

#### Scenario: Anonymous caller accesses core tables
- **WHEN** the `anon` role attempts any `SELECT`, `INSERT`, `UPDATE`, or `DELETE` on `department_info`, `organizations`, `org_memberships`, or `announcements`
- **THEN** PostgreSQL denies access due to missing table privileges and RLS
