# Graph Report - MyCCS  (2026-11-28)

## Corpus Check
- 171 files · ~228,866 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: (none) 13, .example 2, .lock 2)

## Summary
- 1496 nodes · 2930 edges · 117 communities (97 shown, 20 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3182a176`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Root AGENTS.md Guide
- package.json
- Governance, CI/CD & Agent Guides
- Expo App Config (app.json)
- core-schema.ts
- deptOrg.ts
- Proposal: Auth & Privacy-First Identity (`spec-01-auth-identity`)
- Requirements
- Expo App Icon & Splash Assets
- precompressImageForUpload
- AuthIdentityScreen.tsx
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
- MyCcsHubScreen.tsx
- coderabbit-pr-gate.md
- Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)
- Requirements
- ADDED Requirements
- web-admin/package.json
- edge-auth.ts
- Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`)
- Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)
- compilerOptions
- Design: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`)
- App
- Design System: MyCCS
- app.js
- Product
- mediaUpload.ts
- dept-org-pages.test.ts
- devDependencies
- scripts
- web-admin-gmetrix.spec.ts
- DepartmentAboutView.tsx
- web-admin-scaffold.test.ts
- dependencies
- Surface Brief: MyCCS Mobile Journey Prototype (Student + Org Officer)
- student/README.md
- core.ts
- MyCCS Web Admin (`web-admin/`)
- Development Placeholder Seeds (`supabase/development/`)
- compress-image.test.ts
- Requirements
- compress-image/index.ts
- adminAuth.ts
- dept-org.ts
- Proposal: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)
- Design: Auth & Privacy-First Identity (`spec-01-auth-identity`)
- web-admin.ts
- Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)
- Tasks: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)
- Tasks: Auth & Privacy-First Identity (`spec-01-auth-identity`)
- 2026-11-25-spec-02-core-schema-rls/design.md
- Available Project Skill (`.claude/skills/myccs-workflow/`)
- Database Schema, RLS, Grants & Encryption
- Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`)
- Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`)
- Tasks: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)
- imports
- Design: GMetrix CSV Key Distribution, Push Alerts & Faculty Promotion (`spec-05-gmetrix-csv-and-push`)
- Requirement: Mandatory 6-digit email OTP verification
- Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`)
- mobile-gmetrix-keys.test.ts
- Requirement: Deterministic institutional email blind-index lookup
- Requirement: Persistent mobile session storage
- Requirement: Profile access control, role immutability, and admin bootstrapping
- Requirement: Server-side institutional email domain restriction
- metro.config.js
- Milestones & Per-Spec Checklist
- vite.config.ts
- dependencies
- devDependencies
- gmetrixAdmin.ts
- main.tsx
- scripts
- gmetrix.ts
- src/App.tsx
- MyCcsHubScreen.tsx
- certifications.ts
- Proposal: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)
- import-gmetrix-keys/core.ts
- gmetrix-crypto.ts
- gmetrix-csv-push.test.ts
- auth-identity.test.ts
- my-certification-keys/core.ts
- AnnouncementsFeedView.tsx
- Requirements
- identity-crypto.ts
- import-gmetrix-keys/index.ts
- MyCCS Repository Rules (rules.md)
- secure-store.verify.ts
- services/auth.ts
- Standalone Vite+React SPA web-admin/ on Cloudflare Pages
- Product Requirements Document (PRD_MyCCS.md)
- GitHub Actions Multi-Tiered DevSecOps CI/CD Pipeline
- Design: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`)
- formatWebAdminError
- imports
- imports
- MyCCS Documentation Synchronization & Architecture Re-Baseline Brief

## God Nodes (most connected - your core abstractions)
1. `MyCcsHubScreen()` - 32 edges
2. `Surfaces Touched` - 30 edges
3. `useKeysAndAlerts()` - 21 edges
4. `handleImportGMetrixKeysRequest()` - 21 edges
5. `GMetrixImportPanel()` - 19 edges
6. `formatWebAdminError()` - 17 edges
7. `AuthIdentityScreen()` - 17 edges
8. `App()` - 17 edges
9. `Product Requirements Document (PRD_MyCCS.md)` - 17 edges
10. `Root AGENTS.md Guide` - 16 edges

## Surprising Connections (you probably didn't know these)
- `What Changes` --references--> `MobileHubRoute`  [INFERRED]
  openspec/changes/archive/2026-11-28-spec-05-gmetrix-csv-and-push/proposal.md → shared/dept-org.ts
- `1. Shared Contracts, Edge Shared Primitives & Database Migration (`shared/`, `supabase/`)` --references--> `MobileHubRoute`  [INFERRED]
  openspec/changes/archive/2026-11-28-spec-05-gmetrix-csv-and-push/tasks.md → shared/dept-org.ts
- `Goals / Non-Goals` --references--> `AuthIdentityScreen()`  [INFERRED]
  openspec/changes/archive/2026-11-27-spec-04-dept-and-org-pages/design.md → src/screens/AuthIdentityScreen.tsx
- `Context` --references--> `MyCcsHubScreen()`  [INFERRED]
  openspec/changes/archive/2026-11-28-spec-05-gmetrix-csv-and-push/design.md → src/screens/MyCcsHubScreen.tsx
- `Ponytail Shortcut Ledger` --references--> `PushTokenDriver`  [INFERRED]
  openspec/ROADMAP.md → src/services/pushNotifications.ts

## Import Cycles
- None detected.

## Communities (117 total, 20 thin omitted)

### Community 0 - "Root AGENTS.md Guide"
Cohesion: 0.16
Nodes (18): Root AGENTS.md Guide, Phase 0 Dependabot Maintenance (Root + web-admin/), CI/CD Pipeline Specification, Post-Merge CD Phases 4-5 (Expo EAS, Cloudflare Pages, Supabase), PR CI Phases 1-3 (Jira, CodeQL/Snyk/CodeRabbit, Jest/Newman/Playwright), Git Branching & Version Control Strategy, GitHub Directory AGENTS.md Guide (.github/), Jira-Git Workflow Agent (+10 more)

### Community 1 - "package.json"
Cohesion: 0.11
Nodes (18): react, @supabase/supabase-js, @types/react, typescript, zod, main, name, private (+10 more)

### Community 2 - "Governance, CI/CD & Agent Guides"
Cohesion: 0.13
Nodes (11): DevSecOps Sentinel Agent, Jira-Git Workflow Agent, Postman API QA & Documentation Agent, React Native QA Specialist Agent, Jest Coverage Thresholds, Release Manager Agent, Supabase Architect Agent, Git Hygiene Rule (+3 more)

### Community 3 - "Expo App Config (app.json)"
Cohesion: 0.10
Nodes (20): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+12 more)

### Community 4 - "core-schema.ts"
Cohesion: 0.11
Nodes (31): 1. Shared Core Schema Contracts & RBAC Helpers (`shared/`), AnnouncementCreateInputSchema, AnnouncementSchema, AnnouncementUpdateInput, AnnouncementUpdateInputSchema, canManageDepartmentInfo(), canManageOrganization(), canPublishAnnouncement() (+23 more)

### Community 5 - "deptOrg.ts"
Cohesion: 0.14
Nodes (19): Implementation Bug Log, createAnnouncement(), createDepartmentInfo(), DeptOrgEqFilterChain, DeptOrgListTerminal, DeptOrgOrgAnnouncementsFilterChain, DeptOrgSelectChain, DeptOrgSingleTerminal (+11 more)

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

### Community 10 - "AuthIdentityScreen.tsx"
Cohesion: 0.18
Nodes (17): PublicProfileDto, IdentityCard(), IdentityCardProps, styles, AuthenticatedRenderContext, AuthIdentityScreen(), AuthIdentityScreenProps, AuthStep (+9 more)

### Community 11 - "TypeScript Strict Config"
Cohesion: 0.29
Nodes (6): expo/tsconfig.base, compilerOptions, strict, types, exclude, extends

### Community 12 - "MyCCS Plugin Metadata"
Cohesion: 0.50
Nodes (3): description, name, $schema

### Community 15 - "src/lib/supabase.ts"
Cohesion: 0.16
Nodes (16): assertPublishableClientKey(), isSecretSupabaseKeyPrefix(), isServiceRoleJwt(), isSupabaseServiceRoleJwt(), WebAdminEnvSchema, assertMobilePublishableKey(), chunkCountKey(), chunkItemKey() (+8 more)

### Community 26 - "overrides"
Cohesion: 0.22
Nodes (9): minimatch, minimatch, minimatch, overrides, @expo/fingerprint, glob@10, glob@13, test-exclude@7 (+1 more)

### Community 27 - "ADDED Requirements"
Cohesion: 0.20
Nodes (10): ADDED Requirements, Purpose, Requirement: Encrypted student profile provisioning and key versioning, Requirement: Permanent opaque QR token and student ID privacy, Scenario: Key version supports staged rotation, Scenario: Permanent QR token omits all raw PII, Scenario: Public and QR DTO projections exclude raw student ID, Scenario: Tampered QR token fails verification (+2 more)

### Community 28 - "MyCcsHubScreen.tsx"
Cohesion: 0.18
Nodes (23): Announcement, AnnouncementCreateInput, Organization, OrganizationUpdateInput, OrgMembership, RbacActor, findOrganizationById(), getMembershipForOrg() (+15 more)

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
Cohesion: 0.17
Nodes (11): @types/node, @types/react-dom, react, @supabase/supabase-js, @types/react, typescript, zod, name (+3 more)

### Community 34 - "edge-auth.ts"
Cohesion: 0.21
Nodes (15): handleCorsPreflight(), resolveCorsHeaders(), withCorsJson(), authenticateEdgeRequest(), BoundedBodyReadResult, decodeBase64UrlUtf8(), EdgeAuthOptions, EdgeAuthResult (+7 more)

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
Cohesion: 0.06
Nodes (32): Capabilities, Impact, Modified Capabilities, New Capabilities, Out of Scope, Proposal: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`), What Changes, Why (+24 more)

### Community 39 - "App"
Cohesion: 0.43
Nodes (8): App(), handleReturnToLogin(), handleSignIn(), handleSignOut(), syncBrowserPath(), isInternalAdminSignOut(), signInAsAdmin(), signOutAdmin()

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
Cohesion: 0.17
Nodes (19): CompressImageRequestMeta, CompressImageRequestMetaSchema, CompressImageResponseSchema, MediaKindSchema, assertHttpBaseUrl(), defaultReadPreparedBlob(), FetchLike, isWebRuntime() (+11 more)

### Community 44 - "dept-org-pages.test.ts"
Cohesion: 0.09
Nodes (23): DEFAULT_ANNOUNCEMENTS_LIMIT, DeptOrgQueryResult, ORG_ANNOUNCEMENTS_MAX_PAGE_SIZE, ORG_ANNOUNCEMENTS_PAGE_SIZE, ADMIN_PROFILE, applyMockOrderSpecs(), compareMockValues(), evaluatePostgrestCondition() (+15 more)

### Community 45 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, husky, jest, jest-expo, jest-junit, @playwright/test, supabase, @testing-library/react-native (+3 more)

### Community 46 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, android, db:test, ios, prepare, start, test, test:e2e (+3 more)

### Community 47 - "web-admin-gmetrix.spec.ts"
Cohesion: 0.10
Nodes (21): @playwright/test, ADMIN_PERSONA, { Buffer: NodeBuffer }, CapturedImportRequest, createSyntheticAccessToken(), createSyntheticSessionPayload(), encodeBase64Url(), MockAdminEntry (+13 more)

### Community 48 - "DepartmentAboutView.tsx"
Cohesion: 0.19
Nodes (18): DepartmentInfo, DepartmentInfoCreateInput, DepartmentInfoCreateInputSchema, DepartmentInfoUpdateInput, DepartmentLeadershipEntry, formatManilaDate(), areLeadershipEntriesEqual(), DepartmentAboutView() (+10 more)

### Community 49 - "web-admin-scaffold.test.ts"
Cohesion: 0.14
Nodes (17): DepartmentInfoSchema, AdminProfileDtoSchema, WebAdminRouteSchema, appendVaryOrigin(), CorsResolution, DenoEnvGlobal, get(), getAllowedOriginsFromEnv() (+9 more)

### Community 50 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, expo, expo-image-manipulator, expo-secure-store, expo-status-bar, react, react-native, @supabase/supabase-js (+1 more)

### Community 53 - "core.ts"
Cohesion: 0.19
Nodes (14): CompressImageAuthContext, detectImageMimeFromMagicBytes(), FormDataLike, handleCompressImageRequest(), isAllowedInputMime(), isBlobLike(), isMediaKind(), MAX_BODY_BYTES (+6 more)

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
Cohesion: 0.21
Nodes (14): buildPublicStorageObjectUrl(), classifyPersistenceFailure(), CompressImageDeps, CompressImageRuntimeEnv, loadWasmBytes(), resolveRuntimeEnv, CachedRuntime, ensureImageMagickInitialized() (+6 more)

### Community 59 - "adminAuth.ts"
Cohesion: 0.42
Nodes (7): toPublicProfileDto(), evaluateAdminAccess(), fetchVerifiedProfile(), resolveProfileSession(), restoreAdminSession(), revokeLocalSessionSafely(), WebAdminSupabaseClient

### Community 60 - "dept-org.ts"
Cohesion: 0.19
Nodes (22): Surfaces Touched, 1. Shared Media & Department/Org Contracts (`shared/`), AnnouncementFilter, buildOrganizationTree(), compareAnnouncementsNewestFirst(), compareIsoTimestamps(), compareOrgsByName(), DepartmentContactEntry (+14 more)

### Community 61 - "Proposal: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)"
Cohesion: 0.25
Nodes (8): Capabilities, Impact, Modified Capabilities, New Capabilities, Out of Scope, Proposal: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`), What Changes, Why

### Community 62 - "Design: Auth & Privacy-First Identity (`spec-01-auth-identity`)"
Cohesion: 0.29
Nodes (7): Context, Decisions, Design: Auth & Privacy-First Identity (`spec-01-auth-identity`), Goals / Non-Goals, Migration Plan, Risks / Trade-offs, Surfaces Touched

### Community 63 - "web-admin.ts"
Cohesion: 0.24
Nodes (7): AdminAccessEvaluation, BlockedAdminRole, WebAdminEnv, WebAdminRoute, WebAdminRouteResolution, AccessDeniedView(), AccessDeniedViewProps

### Community 64 - "Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)"
Cohesion: 0.19
Nodes (13): Context, Core Data Shapes, Database Schema, RLS, Grants & Encryption, Decisions, Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`), Goals / Non-Goals, Migration Plan, Risks / Trade-offs (+5 more)

### Community 65 - "Tasks: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)"
Cohesion: 0.20
Nodes (7): Purpose, Specification: Standalone Web Admin Portal Scaffold (`web-admin-scaffold`), 2. Mobile Bundle Exclusion & Root Tooling Isolation, 3. Standalone Vite + React SPA, Admin Login & Route Guard (`web-admin/`), 4. Playwright E2E Smoke Tests, CI Integration & Audits (`tests/e2e/`, `.github/`), Tasks: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`), Workflow follow-up

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
Cohesion: 0.29
Nodes (6): imports, @imagemagick/magick-wasm, ../_shared/cors, ../_shared/edge-auth, ../_shared/media-upload-constants, @supabase/supabase-js

### Community 74 - "Design: GMetrix CSV Key Distribution, Push Alerts & Faculty Promotion (`spec-05-gmetrix-csv-and-push`)"
Cohesion: 0.05
Nodes (39): Context, Core Data Shapes, Database Schema, RLS, Grants & Encryption, Decisions, Design: GMetrix CSV Key Distribution, Push Alerts & Faculty Promotion (`spec-05-gmetrix-csv-and-push`), Goals / Non-Goals, Migration Plan, Risks / Trade-offs (+31 more)

### Community 76 - "Requirement: Mandatory 6-digit email OTP verification"
Cohesion: 0.50
Nodes (4): Requirement: Mandatory 6-digit email OTP verification, Scenario: Invalid or expired OTP is rejected, Scenario: Unconfirmed signup cannot establish an active session, Scenario: Valid 6-digit OTP confirms account and issues session

### Community 77 - "Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`)"
Cohesion: 0.50
Nodes (4): Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`), Scenario: Officer attempts to publish a department-wide or cross-org announcement, Scenario: Officer publishes an announcement for their assigned organization, Scenario: Student reads active global and joined-organization announcements

### Community 78 - "mobile-gmetrix-keys.test.ts"
Cohesion: 0.10
Nodes (27): Certification, DecryptedCertificationKey, Notification, PushPlatform, CertificationsAndKeysViewProps, UseKeysAndAlertsParams, UseKeysAndAlertsResult, MyCcsHubScreenProps (+19 more)

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

### Community 84 - "metro.config.js"
Cohesion: 0.22
Nodes (6): config, { getDefaultConfig }, path, webAdminAbsolutePattern, webAdminDir, expo

### Community 85 - "Milestones & Per-Spec Checklist"
Cohesion: 0.25
Nodes (8): Milestone 1 — Foundation, Auth & Security (Sprint 1), Milestone 2 — Org Hub, Media & GMetrix Distribution (Sprint 2), Milestone 3 — Events, Offline Attendance & Conditional Forms (Sprint 3), Milestone 4 — Hardening, QA & Production Cutover (Sprint 4), Milestones & Per-Spec Checklist, MyCCS OpenSpec SDD Roadmap, Spec Checklist & Bug Tracker, Ponytail Implementation Rules (Apply to Every Spec), Ponytail Shortcut Ledger

### Community 86 - "vite.config.ts"
Cohesion: 0.29
Nodes (5): vite, @vitejs/plugin-react, rootDir, sharedDir, supabaseSharedDir

### Community 87 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, @fontsource/jetbrains-mono, @fontsource/public-sans, react, react-dom, @supabase/supabase-js, zod

### Community 88 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, @types/node, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react

### Community 89 - "gmetrixAdmin.ts"
Cohesion: 0.09
Nodes (34): AdminDirectoryEntry, CertificationCreateInput, CertificationCreateInputSchema, CertificationKeyBatch, CertificationKeyBatchSchema, ImportGMetrixKeysResponse, ImportGMetrixKeysResponseSchema, PromoteFacultyResult (+26 more)

### Community 90 - "main.tsx"
Cohesion: 0.33
Nodes (4): @fontsource/jetbrains-mono, @fontsource/public-sans, react-dom, rootElement

### Community 91 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, typecheck

### Community 92 - "gmetrix.ts"
Cohesion: 0.10
Nodes (28): DecryptedCertificationKeySchema, ExpoPushTokenSchema, IsoTimestampSchema, NotificationSchema, NotificationType, NotificationTypeSchema, PushPlatformSchema, RejectedRow (+20 more)

### Community 93 - "src/App.tsx"
Cohesion: 0.22
Nodes (9): AdminProfileDto, AdminDashboardShell(), AdminDashboardShellProps, AdminWorkspaceTab, LoginView(), LoginViewProps, getWebAdminSupabaseClient(), getWebAdminSupabaseConfig() (+1 more)

### Community 94 - "MyCcsHubScreen.tsx"
Cohesion: 0.12
Nodes (25): App(), @testing-library/react-native, parseNotificationDeepLink(), CertificationsAndKeysView(), isKeysRoute(), mergeReadNotificationOverrides(), mergeViewedKeyOverrides(), useKeysAndAlerts() (+17 more)

### Community 95 - "certifications.ts"
Cohesion: 0.11
Nodes (20): CertificationSchema, assertHttpBaseUrl(), CertificationKeyViewedRowSchema, CertificationsListTerminal, CertificationsSelectEqChain, CertificationsTableBuilder, CertificationsUpdateChain, DEFAULT_NOTIFICATIONS_LIMIT (+12 more)

### Community 96 - "Proposal: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)"
Cohesion: 0.25
Nodes (8): Capabilities, Impact, Modified Capabilities, New Capabilities, Out of Scope, Proposal: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`), What Changes, Why

### Community 97 - "import-gmetrix-keys/core.ts"
Cohesion: 0.11
Nodes (26): CertificationRecord, CommitGMetrixKeyBatchResult, CommitGMetrixKeyEntry, EXPO_PUSH_MAX_CONCURRENCY, FormDataLike, GMetrixCryptoSecrets, handleImportGMetrixKeysRequest(), hasValidSecretBytes() (+18 more)

### Community 98 - "gmetrix-crypto.ts"
Cohesion: 0.18
Nodes (23): Surfaces Touched, computeEmailBlindIndex(), bytesToHex(), computeEmailBlindIndex(), computeKeyCodeHash(), createHmacKey(), DecryptedKeyPayload, encodeByteaHex() (+15 more)

### Community 99 - "gmetrix-csv-push.test.ts"
Cohesion: 0.12
Nodes (17): AdminDirectoryEntrySchema, maskCertificationKey(), CommitGMetrixKeyBatchInput, ExpoPushMessage, MAX_BODY_BYTES, GMETRIX_MY_KEYS_DEEP_LINK, makeJsonImportRequest(), makeMultipartImportRequest() (+9 more)

### Community 100 - "auth-identity.test.ts"
Cohesion: 0.14
Nodes (18): INSTITUTIONAL_EMAIL_DOMAIN, InstitutionalEmailSchema, isInstitutionalEmail(), normalizeInstitutionalEmail(), OtpCodeSchema, ProfileProjectionInput, PublicProfileDtoSchema, QrTokenSchema (+10 more)

### Community 101 - "my-certification-keys/core.ts"
Cohesion: 0.15
Nodes (18): CallerActiveProfile, createMyKeysRingResolver(), DecryptedCertificationKeyDto, EncryptedCertificationKeyRow, extractCertificationMeta(), JoinedCertification, LoadKeyRingOptions, mapPostgrestCertificationKeyRow() (+10 more)

### Community 102 - "AnnouncementsFeedView.tsx"
Cohesion: 0.20
Nodes (14): react-native, FILTER_OPTIONS, styles, formatNotificationTypeLabel(), KeysSectionId, MONO_FONT_FAMILY, SECTION_TABS, styles (+6 more)

### Community 103 - "Requirements"
Cohesion: 0.12
Nodes (16): gmetrix-csv-and-push Specification, Purpose, Requirement: Authenticated Mobile Certification Directory, My Keys & In-App Alerts (`FR-CERT-01`, `FR-CERT-05`), Requirement: Blind-Index Matching, Idempotent Partial Commit & Sanitized Fallback CSV (`FR-CERT-02`, `FR-CERT-03`, `FR-CERT-04`), Requirement: Certification, Encrypted Key, Notification & Push Token Schema with RLS (`FR-CERT-01`, `ADR-008`, `SAB §6`), Requirement: Content-Free Expo Push Notifications (`FR-CERT-05`, `SAB §7.2`), Requirement: Web Admin GMetrix Distribution & Faculty-to-Admin Promotion UI (`FR-CERT-02`, `FR-CERT-04`, `FR-AUTH-02`, `ADR-009`), Requirements (+8 more)

### Community 104 - "identity-crypto.ts"
Cohesion: 0.20
Nodes (16): DecryptedPiiPayload, decryptPii(), EncryptedPiiPayload, encryptPii(), generateOpaqueQrToken(), rotateEncryptedPii(), textEncoder, UuidSchema (+8 more)

### Community 105 - "import-gmetrix-keys/index.ts"
Cohesion: 0.18
Nodes (14): CallerProfileRecord, createImportSecretsResolver(), createRpcDatabaseAdapter(), DEFAULT_PUSH_BUDGET_MS, ExpoPushTicket, ImportGMetrixKeysDeps, parseExpoPushTickets(), RpcCallerLike (+6 more)

### Community 106 - "MyCCS Repository Rules (rules.md)"
Cohesion: 0.24
Nodes (10): Verified @lpunetwork.edu.ph Email+Password+6-Digit OTP Auth, Server-Side before-user-created @lpunetwork.edu.ph Auth Hook, Software Architecture Baseline (SCRUM-9), Resend Custom SMTP (6-Digit Verification OTP), Supabase Backend (PostgreSQL 17, Auth, Storage, Deno 2), Atomic Commit Rule (Client + Supabase), MyCCS Repository Rules (rules.md), Sensitive File Guard (+2 more)

### Community 107 - "secure-store.verify.ts"
Cohesion: 0.18
Nodes (6): encoder, Op, SimulatedCrash, summarizeSessionValue(), utf8Bytes(), SECURE_STORE_CHUNK_BYTES

### Community 108 - "services/auth.ts"
Cohesion: 0.18
Nodes (11): SignInRequest, SignInRequestSchema, SignupRequest, SignupRequestSchema, UserRole, VerifyOtpRequest, VerifyOtpRequestSchema, AuthSession (+3 more)

### Community 109 - "Standalone Vite+React SPA web-admin/ on Cloudflare Pages"
Cohesion: 0.20
Nodes (9): Shared Contracts (shared/), SQL-Seeded Admin Bootstrapping & Faculty Promotion, Web Admin GMetrix CSV Key Distribution, Offline-First Permanent QR Attendance, Edge Function: compress-image (EXIF Strip & WebP), Content-Free Expo Push Notifications, Edge Function: import-gmetrix-keys, MyCCS Mobile App (Expo React Native + SQLite) (+1 more)

### Community 110 - "Product Requirements Document (PRD_MyCCS.md)"
Cohesion: 0.24
Nodes (9): Docs Directory AGENTS.md Guide (docs/), Documentation SSOT Boundaries, Agile Project Brief & Proposal, 4-Sprint Agile Delivery Roadmap, SMART Objectives (<200ms QR, <10s 500-row CSV, 100% Sync), Bounded Conditional Form Builder (JSONB + Zod), Product Requirements Document (PRD_MyCCS.md), Two-Tier Organization Hierarchy (Main Org -> Sub-Org) (+1 more)

### Community 111 - "GitHub Actions Multi-Tiered DevSecOps CI/CD Pipeline"
Cohesion: 0.33
Nodes (9): DevSecOps Sentinel Agent, React Native QA Specialist Agent, Release Manager Agent, CI Phase 3: Automated QA (Jest, Newman, Playwright), CI Phase 5: Production Deploy (Web Admin & Supabase), CI Phase 4: Expo EAS Build, GitHub Actions Multi-Tiered DevSecOps CI/CD Pipeline, CI Phase 2: Static Analysis (CodeRabbit, CodeQL, Snyk) (+1 more)

### Community 112 - "Design: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`)"
Cohesion: 0.25
Nodes (8): Context, Core Data Shapes, Database Schema, RLS, Grants & Encryption, Decisions, Design: Department About, Announcements Feed, Org Pages & Image Compression (`spec-04-dept-and-org-pages`), Goals / Non-Goals, Migration Plan, Risks / Trade-offs

### Community 113 - "formatWebAdminError"
Cohesion: 0.52
Nodes (6): formatWebAdminError(), FacultyPromotionPanel(), handlePromoteSubmit(), FacultyPromotionPanelProps, listAdminProfiles(), promoteFacultyByEmail()

### Community 114 - "imports"
Cohesion: 0.29
Nodes (6): imports, ../_shared/cors, ../_shared/edge-auth, ../_shared/gmetrix-crypto, ../_shared/gmetrix-csv, @supabase/supabase-js

### Community 115 - "imports"
Cohesion: 0.33
Nodes (5): imports, ../_shared/cors, ../_shared/edge-auth, ../_shared/gmetrix-crypto, @supabase/supabase-js

## Knowledge Gaps
- **34 isolated node(s):** `@supabase/supabase-js`, `react`, `zod`, `@types/jest`, `@types/react` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 673 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MyCCS OpenSpec SDD Roadmap, Spec Checklist & Bug Tracker` connect `Milestones & Per-Spec Checklist` to `MyCCS Repository Rules (rules.md)`, `deptOrg.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `MyCcsHubScreen()` (e.g. with `Decisions` and `Surfaces Touched`) actually correct?**
  _`MyCcsHubScreen()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@supabase/supabase-js`, `react`, `zod` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `Implementation Bug Log` connect `deptOrg.ts` to `AuthIdentityScreen.tsx`, `MyCcsHubScreen.tsx`, `mobile-gmetrix-keys.test.ts`, `DepartmentAboutView.tsx`, `formatWebAdminError`, `Milestones & Per-Spec Checklist`, `gmetrixAdmin.ts`, `dept-org.ts`, `MyCcsHubScreen.tsx`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 29 inferred relationships involving `Surfaces Touched` (e.g. with `MobileHubRoute` and `maskCertificationKey()`) actually correct?**
  _`Surfaces Touched` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Should `Governance, CI/CD & Agent Guides` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._