# Graph Report - MyCCS  (2026-11-28)

## Corpus Check
- 144 files · ~188,182 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: (none) 13, .lock 3, .example 2)

## Summary
- 1114 nodes · 1989 edges · 78 communities (59 shown, 19 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 95 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2ed396b5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MyCCS Product, Auth & Architecture
- package.json
- Governance, CI/CD & Agent Guides
- Expo App Config (app.json)
- OrgDetailView.tsx
- core-schema.ts
- Proposal: Auth & Privacy-First Identity (`spec-01-auth-identity`)
- Requirements
- Expo App Icon & Splash Assets
- precompressImageForUpload
- OrgDirectoryView.tsx
- TypeScript Strict Config
- MyCCS Plugin Metadata
- Env Command Guard Hook
- Sensitive File Guard Hook
- src/lib/supabase.ts
- Branch Protection Script
- Skill Sync Script
- Dependabot Configuration
- OpenSpec Configuration
- overrides
- ADDED Requirements
- auth-identity.test.ts
- coderabbit-pr-gate.md
- Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)
- Requirements
- ADDED Requirements
- web-admin/package.json
- web-admin-scaffold.test.ts
- Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`)
- Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)
- compilerOptions
- Design: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`)
- web-admin.ts
- Design System: MyCCS
- app.js
- Product
- mediaUpload.ts
- dept-org.ts
- devDependencies
- scripts
- web-admin-guard.spec.ts
- deptOrg.ts
- dependencies
- Surface Brief: MyCCS Mobile Journey Prototype (Student + Org Officer)
- student/README.md
- core.ts
- MyCCS Web Admin (`web-admin/`)
- Development Placeholder Seeds (`supabase/development/`)
- compress-image.test.ts
- Requirements
- compress-image/index.ts
- MyCcsHubScreen.tsx
- dept-org-pages.test.ts
- Proposal: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)
- Design: Auth & Privacy-First Identity (`spec-01-auth-identity`)
- Tasks: Auth & Privacy-First Identity (`spec-01-auth-identity`)
- 2026-11-25-spec-02-core-schema-rls/design.md
- Database Schema, RLS, Grants & Encryption
- Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`)
- Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`)
- Tasks: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)
- imports
- Requirement: Mandatory 6-digit email OTP verification
- Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`)
- LeanCTX — Context Gateway for AI Systems
- Requirement: Deterministic institutional email blind-index lookup
- Requirement: Persistent mobile session storage
- Requirement: Profile access control, role immutability, and admin bootstrapping
- Requirement: Server-side institutional email domain restriction

## God Nodes (most connected - your core abstractions)
1. `MyCcsHubScreen()` - 25 edges
2. `AuthIdentityScreen()` - 17 edges
3. `Product Requirements Document (PRD_MyCCS.md)` - 17 edges
4. `App()` - 16 edges
5. `Root AGENTS.md Guide` - 16 edges
6. `MyCCS Repository Rules (rules.md)` - 16 edges
7. `OrgDetailView()` - 15 edges
8. `compilerOptions` - 15 edges
9. `CI/CD Pipeline Specification` - 15 edges
10. `Organization` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Goals / Non-Goals` --references--> `AuthIdentityScreen()`  [INFERRED]
  openspec/changes/archive/2026-11-27-spec-04-dept-and-org-pages/design.md → src/screens/AuthIdentityScreen.tsx
- `Implementation Bug Log` --references--> `PublicProfileDto`  [INFERRED]
  openspec/ROADMAP.md → shared/auth.ts
- `Surfaces Touched` --references--> `OrganizationTreeNode`  [INFERRED]
  openspec/changes/archive/2026-11-27-spec-04-dept-and-org-pages/design.md → shared/dept-org.ts
- `Decisions` --references--> `MobileHubRoute`  [INFERRED]
  openspec/changes/archive/2026-11-27-spec-04-dept-and-org-pages/design.md → shared/dept-org.ts
- `What Changes` --references--> `MobileHubRoute`  [INFERRED]
  openspec/changes/archive/2026-11-27-spec-04-dept-and-org-pages/proposal.md → shared/dept-org.ts

## Import Cycles
- None detected.

## Communities (78 total, 19 thin omitted)

### Community 0 - "MyCCS Product, Auth & Architecture"
Cohesion: 0.06
Nodes (57): Root AGENTS.md Guide, Shared Contracts (shared/), MyCCS Documentation Synchronization & Architecture Re-Baseline Brief, Docs Directory AGENTS.md Guide (docs/), Documentation SSOT Boundaries, Phase 0 Dependabot Maintenance (Root + web-admin/), CI/CD Pipeline Specification, Post-Merge CD Phases 4-5 (Expo EAS, Cloudflare Pages, Supabase) (+49 more)

### Community 1 - "package.json"
Cohesion: 0.11
Nodes (18): react, @supabase/supabase-js, @types/react, typescript, zod, main, name, private (+10 more)

### Community 2 - "Governance, CI/CD & Agent Guides"
Cohesion: 0.13
Nodes (11): DevSecOps Sentinel Agent, Jira-Git Workflow Agent, Postman API QA & Documentation Agent, React Native QA Specialist Agent, Jest Coverage Thresholds, Release Manager Agent, Supabase Architect Agent, Git Hygiene Rule (+3 more)

### Community 3 - "Expo App Config (app.json)"
Cohesion: 0.10
Nodes (19): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+11 more)

### Community 4 - "OrgDetailView.tsx"
Cohesion: 0.28
Nodes (15): Announcement, AnnouncementCreateInput, Organization, OrganizationUpdateInput, OrgMembership, RbacActor, CompressImageResponse, AnnouncementsFeedViewProps (+7 more)

### Community 5 - "core-schema.ts"
Cohesion: 0.08
Nodes (31): AnnouncementCreateInputSchema, AnnouncementSchema, AnnouncementUpdateInput, AnnouncementUpdateInputSchema, DepartmentInfoCreateInputSchema, DepartmentInfoSchema, DepartmentInfoUpdateInputSchema, DepartmentLeadershipEntry (+23 more)

### Community 6 - "Proposal: Auth & Privacy-First Identity (`spec-01-auth-identity`)"
Cohesion: 0.25
Nodes (8): Capabilities, Impact, Modified Capabilities, New Capabilities, Out of Scope, Proposal: Auth & Privacy-First Identity (`spec-01-auth-identity`), What Changes, Why

### Community 7 - "Requirements"
Cohesion: 0.07
Nodes (26): auth-identity Specification, Purpose, Requirement: Deterministic institutional email blind-index lookup, Requirement: Encrypted student profile provisioning and key versioning, Requirement: Mandatory 6-digit email OTP verification, Requirement: Permanent opaque QR token and student ID privacy, Requirement: Persistent mobile session storage, Requirement: Profile access control, role immutability, and admin bootstrapping (+18 more)

### Community 8 - "Expo App Icon & Splash Assets"
Cohesion: 0.47
Nodes (6): Android Adaptive Icon Background (Expo Blueprint Grid), Android Adaptive Icon Foreground (Blue Expo Chevron), Android Adaptive Icon Monochrome (Gray Expo Chevron), Web Favicon (Rounded Blue Expo Chevron), Primary App Icon (Composite Expo Chevron on Blueprint), Splash Screen Icon (Concentric Rings on Black Grid)

### Community 9 - "precompressImageForUpload"
Cohesion: 0.25
Nodes (4): ImageManipulatorContextLike, ImageManipulatorDriver, ManipulatedImageRef, precompressImageForUpload()

### Community 10 - "OrgDirectoryView.tsx"
Cohesion: 0.39
Nodes (7): getMembershipForOrg(), getOrgInitials(), MembershipBadgeConfig, OrgDirectoryView(), OrgRow(), resolveMembershipBadge(), styles

### Community 11 - "TypeScript Strict Config"
Cohesion: 0.29
Nodes (6): expo/tsconfig.base, compilerOptions, strict, types, exclude, extends

### Community 12 - "MyCCS Plugin Metadata"
Cohesion: 0.50
Nodes (3): description, name, $schema

### Community 15 - "src/lib/supabase.ts"
Cohesion: 0.05
Nodes (36): config, { getDefaultConfig }, path, webAdminAbsolutePattern, webAdminDir, expo, vite, @vitejs/plugin-react (+28 more)

### Community 26 - "overrides"
Cohesion: 0.22
Nodes (9): minimatch, minimatch, minimatch, overrides, @expo/fingerprint, glob@10, glob@13, test-exclude@7 (+1 more)

### Community 27 - "ADDED Requirements"
Cohesion: 0.20
Nodes (10): ADDED Requirements, Purpose, Requirement: Encrypted student profile provisioning and key versioning, Requirement: Permanent opaque QR token and student ID privacy, Scenario: Key version supports staged rotation, Scenario: Permanent QR token omits all raw PII, Scenario: Public and QR DTO projections exclude raw student ID, Scenario: Tampered QR token fails verification (+2 more)

### Community 28 - "auth-identity.test.ts"
Cohesion: 0.06
Nodes (72): App(), Decisions, @testing-library/react-native, INSTITUTIONAL_EMAIL_DOMAIN, InstitutionalEmailSchema, isInstitutionalEmail(), normalizeInstitutionalEmail(), OtpCodeSchema (+64 more)

### Community 30 - "Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)"
Cohesion: 0.18
Nodes (11): 1. Anti-Recursion RBAC Helpers (`SECURITY DEFINER`, `STABLE`, `SET search_path = public`), 2. Tables, Triggers & Explicit `GRANT`s, 3. RLS Policy Matrix, Context, Database Schema, RLS, Grants & Encryption, Decisions, Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`), Goals / Non-Goals (+3 more)

### Community 31 - "Requirements"
Cohesion: 0.08
Nodes (23): core-schema-rls Specification, Purpose, Requirement: Department Information Storage & Admin-Only Governance (`FR-DEPT-01`), Requirement: Mandatory Row Level Security & Explicit Grants (`ADR-005`), Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`), Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`), Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`), Requirements (+15 more)

### Community 32 - "ADDED Requirements"
Cohesion: 0.29
Nodes (7): ADDED Requirements, Requirement: Department Information Storage & Admin-Only Governance (`FR-DEPT-01`), Requirement: Mandatory Row Level Security & Explicit Grants (`ADR-005`), Scenario: Admin updates department information, Scenario: Anonymous caller accesses core tables, Scenario: Authenticated student reads department information, Scenario: Non-admin attempts to modify department information

### Community 33 - "web-admin/package.json"
Cohesion: 0.06
Nodes (34): @fontsource/jetbrains-mono, @fontsource/public-sans, react-dom, @types/node, @types/react-dom, dependencies, @fontsource/jetbrains-mono, @fontsource/public-sans (+26 more)

### Community 34 - "web-admin-scaffold.test.ts"
Cohesion: 0.16
Nodes (19): AdminProfileDtoSchema, WebAdminRouteSchema, appendVaryOrigin(), CorsResolution, DenoEnvGlobal, get(), getAllowedOriginsFromEnv(), handleCorsPreflight() (+11 more)

### Community 35 - "Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`)"
Cohesion: 0.10
Nodes (20): Purpose, Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`), Requirement: Cloudflare Pages Root-Directory Deployment Configuration (`ADR-009`), Requirement: Fail-Closed Edge Function CORS Allowlist (`ADR-009`, `SAB §8`), Requirement: Shared TypeScript DTOs and Zod Contracts (`ADR-009`, `FR-AUTH-01`, `FR-CERT-02`), Requirement: Standalone Web Admin SPA Excluded from Mobile Bundle (`ADR-009`), Requirements, Scenario: Admin access evaluation enforces strict admin role (+12 more)

### Community 36 - "Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)"
Cohesion: 0.11
Nodes (18): ADDED Requirements, Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`), Requirement: Cloudflare Pages Root-Directory Deployment Configuration (`ADR-009`), Requirement: Fail-Closed Edge Function CORS Allowlist (`ADR-009`, `SAB §8`), Requirement: Shared TypeScript DTOs and Zod Contracts (`ADR-009`, `FR-AUTH-01`, `FR-CERT-02`), Requirement: Standalone Web Admin SPA Excluded from Mobile Bundle (`ADR-009`), Scenario: Admin access evaluation enforces strict admin role, Scenario: Allowlisted Web Admin origin passes CORS preflight and responses (+10 more)

### Community 37 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 38 - "Design: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`)"
Cohesion: 0.05
Nodes (39): Context, Core Data Shapes, Database Schema, RLS, Grants & Encryption, Design: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`), Goals / Non-Goals, Migration Plan, Risks / Trade-offs, Capabilities (+31 more)

### Community 39 - "web-admin.ts"
Cohesion: 0.05
Nodes (59): Context, Core Data Shapes, Database Schema, RLS, Grants & Encryption, Decisions, Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`), Goals / Non-Goals, Migration Plan, Risks / Trade-offs (+51 more)

### Community 40 - "Design System: MyCCS"
Cohesion: 0.09
Nodes (21): Buttons, Colors, Components, Design System: MyCCS, Do:, Do's and Don'ts, Don't:, Elevation & Depth (+13 more)

### Community 41 - "app.js"
Cohesion: 0.22
Nodes (19): currentScreen(), escapeAttr(), escapeHtml(), formatEventOffset(), goTo(), hasOwnVariation(), isValidInstitutionalEmail(), isValidMeetingLink() (+11 more)

### Community 42 - "Product"
Cohesion: 0.17
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 43 - "mediaUpload.ts"
Cohesion: 0.16
Nodes (21): CompressImageRequestMeta, CompressImageRequestMetaSchema, CompressImageResponseSchema, MediaKindSchema, assertHttpBaseUrl(), defaultReadPreparedBlob(), FetchLike, isWebRuntime() (+13 more)

### Community 44 - "dept-org.ts"
Cohesion: 0.14
Nodes (33): 1. Shared Core Schema Contracts & RBAC Helpers (`shared/`), Surfaces Touched, 1. Shared Media & Department/Org Contracts (`shared/`), Implementation Bug Log, canManageDepartmentInfo(), canManageOrganization(), canPublishAnnouncement(), canReviewMembership() (+25 more)

### Community 45 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, husky, jest, jest-expo, jest-junit, @playwright/test, supabase, @testing-library/react-native (+3 more)

### Community 46 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, android, db:test, ios, prepare, start, test, test:e2e (+3 more)

### Community 47 - "web-admin-guard.spec.ts"
Cohesion: 0.24
Nodes (8): @playwright/test, createSyntheticAccessToken(), createSyntheticSessionPayload(), encodeBase64Url(), MockCounters, MockPersona, MockRouteOptions, setupSupabaseRoutes()

### Community 49 - "deptOrg.ts"
Cohesion: 0.11
Nodes (24): Available Project Skill (`.claude/skills/myccs-workflow/`), MyCCS Claude Code Instructions, Milestone 1 — Foundation, Auth & Security (Sprint 1), Milestone 2 — Org Hub, Media & GMetrix Distribution (Sprint 2), Milestone 3 — Events, Offline Attendance & Conditional Forms (Sprint 3), Milestone 4 — Hardening, QA & Production Cutover (Sprint 4), Milestones & Per-Spec Checklist, MyCCS OpenSpec SDD Roadmap, Spec Checklist & Bug Tracker (+16 more)

### Community 50 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, expo, expo-image-manipulator, expo-secure-store, expo-status-bar, react, react-native, @supabase/supabase-js (+1 more)

### Community 53 - "core.ts"
Cohesion: 0.16
Nodes (18): BoundedBodyReadResult, decodeBase64UrlUtf8(), detectImageMimeFromMagicBytes(), FormDataLike, handleCompressImageRequest(), isAllowedInputMime(), isBlobLike(), isMediaKind() (+10 more)

### Community 54 - "MyCCS Web Admin (`web-admin/`)"
Cohesion: 0.33
Nodes (5): Architecture Boundaries, Cloudflare Pages Deployment, Local Development, MyCCS Web Admin (`web-admin/`), Verification

### Community 55 - "Development Placeholder Seeds (`supabase/development/`)"
Cohesion: 0.50
Nodes (3): Development Placeholder Seeds (`supabase/development/`), Placeholder Accounts, Usage

### Community 56 - "compress-image.test.ts"
Cohesion: 0.10
Nodes (19): buildValidFormData(), HTML_BYTES, JPEG_BYTES, makeBlobFile(), makeMultipartRequest(), makeTestJwt(), makeValidToken(), nodeFs (+11 more)

### Community 57 - "Requirements"
Cohesion: 0.10
Nodes (19): dept-and-org-pages Specification, Purpose, Requirement: Department About Screen & Admin Governance (`FR-DEPT-01`), Requirement: Expiration-Aware Department & Organization Announcements Feed (`FR-DEPT-02`), Requirement: On-Device Image Pre-Compression (`SAB §7.3`, `ADR-007`), Requirement: Server-Side `compress-image` Edge Function & EXIF-Stripped WebP Pipeline (`FR-ORG-02`, `SAB §7.3`, `ADR-007`), Requirement: Two-Tier Organization Directory & Simplified Read-Only Org Page (`FR-ORG-01`, `FR-ORG-02`), Requirements (+11 more)

### Community 58 - "compress-image/index.ts"
Cohesion: 0.20
Nodes (13): buildPublicStorageObjectUrl(), CompressImageAuthContext, CompressImageRuntimeEnv, loadWasmBytes(), resolvePublicStorageBaseUrl(), resolveRuntimeEnv(), CachedRuntime, ensureImageMagickInitialized() (+5 more)

### Community 59 - "MyCcsHubScreen.tsx"
Cohesion: 0.16
Nodes (24): react-native, DepartmentInfo, DepartmentInfoCreateInput, DepartmentInfoUpdateInput, FILTER_OPTIONS, styles, DepartmentAboutView(), DepartmentAboutViewProps (+16 more)

### Community 60 - "dept-org-pages.test.ts"
Cohesion: 0.12
Nodes (12): MyCcsHubScreenProps, DeptOrgSupabaseClient, ADMIN_PROFILE, NOW, OFFICER_PROFILE, SAMPLE_ANNOUNCEMENTS, SAMPLE_DEPT, SAMPLE_ORG_A (+4 more)

### Community 61 - "Proposal: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)"
Cohesion: 0.25
Nodes (8): Capabilities, Impact, Modified Capabilities, New Capabilities, Out of Scope, Proposal: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`), What Changes, Why

### Community 62 - "Design: Auth & Privacy-First Identity (`spec-01-auth-identity`)"
Cohesion: 0.29
Nodes (7): Context, Decisions, Design: Auth & Privacy-First Identity (`spec-01-auth-identity`), Goals / Non-Goals, Migration Plan, Risks / Trade-offs, Surfaces Touched

### Community 66 - "Tasks: Auth & Privacy-First Identity (`spec-01-auth-identity`)"
Cohesion: 0.33
Nodes (6): 1. Shared Auth, Crypto & Identity Contracts (`shared/`), 2. Supabase Auth Hook, `profiles` Migration, RLS, Explicit `GRANT`s & Admin Seed (`supabase/`), 3. Mobile Expo SecureStore Session & Auth Flow (`root mobile app`), 4. Integration Verification & Local Gates (`tests/` & CI Parity), Tasks: Auth & Privacy-First Identity (`spec-01-auth-identity`), Workflow follow-up

### Community 69 - "Database Schema, RLS, Grants & Encryption"
Cohesion: 0.40
Nodes (5): 1. Server-Side `before-user-created` Auth Hook, 2. `public.profiles` Table Schema, 3. Explicit `GRANT`s & Row Level Security, 4. Encryption, Blind Index & Opaque QR Architecture, Database Schema, RLS, Grants & Encryption

### Community 70 - "Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`)"
Cohesion: 0.40
Nodes (5): Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`), Scenario: Organization officer approves a member application, Scenario: Organization officer attempts to promote a member to officer, Scenario: Student attempts to self-approve or claim officer role, Scenario: Student submits a pending membership application

### Community 71 - "Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`)"
Cohesion: 0.40
Nodes (5): Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`), Scenario: Assigned officer customizes their organization page, Scenario: Creating a Sub-Organization under a Main Organization, Scenario: Officer attempts to edit another organization, Scenario: Rejecting three-level nesting or self-parenting

### Community 72 - "Tasks: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)"
Cohesion: 0.40
Nodes (5): 2. Core Schema Migration, 3-Role RBAC RLS & Explicit `GRANT`s (`supabase/`), 3. Per-Role RLS Contract & Newman Verification Suites (`tests/api/`), 4. Integration Verification, Ponytail Audit & Local Gates, Tasks: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`), Workflow follow-up

### Community 73 - "imports"
Cohesion: 0.33
Nodes (5): imports, @imagemagick/magick-wasm, ../_shared/cors, ../_shared/media-upload-constants, @supabase/supabase-js

### Community 76 - "Requirement: Mandatory 6-digit email OTP verification"
Cohesion: 0.50
Nodes (4): Requirement: Mandatory 6-digit email OTP verification, Scenario: Invalid or expired OTP is rejected, Scenario: Unconfirmed signup cannot establish an active session, Scenario: Valid 6-digit OTP confirms account and issues session

### Community 77 - "Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`)"
Cohesion: 0.50
Nodes (4): Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`), Scenario: Officer attempts to publish a department-wide or cross-org announcement, Scenario: Officer publishes an announcement for their assigned organization, Scenario: Student reads active global and joined-organization announcements

### Community 79 - "Requirement: Deterministic institutional email blind-index lookup"
Cohesion: 0.67
Nodes (3): Requirement: Deterministic institutional email blind-index lookup, Scenario: Different emails produce distinct blind indexes, Scenario: Equivalent email casing and whitespace produce identical blind index

### Community 80 - "Requirement: Persistent mobile session storage"
Cohesion: 0.67
Nodes (3): Requirement: Persistent mobile session storage, Scenario: Authenticated session persists across app restarts, Scenario: Sign-out clears persisted session

### Community 81 - "Requirement: Profile access control, role immutability, and admin bootstrapping"
Cohesion: 0.67
Nodes (3): Requirement: Profile access control, role immutability, and admin bootstrapping, Scenario: Initial admin bootstrap and faculty promotion, Scenario: Student reads own profile but cannot read peers or escalate role

### Community 82 - "Requirement: Server-side institutional email domain restriction"
Cohesion: 0.67
Nodes (3): Requirement: Server-side institutional email domain restriction, Scenario: Institutional email signup is accepted, Scenario: Non-institutional email signup is rejected server-side

## Knowledge Gaps
- **34 isolated node(s):** `@supabase/supabase-js`, `react`, `zod`, `@types/jest`, `@types/react` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 527 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Tasks: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)` connect `Tasks: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)` to `2026-11-25-spec-02-core-schema-rls/design.md`, `dept-org.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `MyCcsHubScreen()` (e.g. with `Decisions` and `Surfaces Touched`) actually correct?**
  _`MyCcsHubScreen()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@supabase/supabase-js`, `react`, `zod` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MyCCS Product, Auth & Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.05789235639981909 - nodes in this community are weakly interconnected._
- **Why does `1. Shared Core Schema Contracts & RBAC Helpers (`shared/`)` connect `dept-org.ts` to `Tasks: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `AuthIdentityScreen()` (e.g. with `Decisions` and `Goals / Non-Goals`) actually correct?**
  _`AuthIdentityScreen()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._