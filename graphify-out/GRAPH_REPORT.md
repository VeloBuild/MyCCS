# Graph Report - MyCCS  (2026-11-27)

## Corpus Check
- 117 files · ~157,447 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 20 file(s) not represented in the graph (top: (none) 13, .example 2, .css 2)

## Summary
- 822 nodes · 1205 edges · 55 communities (38 shown, 17 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bbed4eb3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MyCCS Product, Auth & Architecture
- package.json
- Governance, CI/CD & Agent Guides
- Expo App Config (app.json)
- AuthIdentityScreen.tsx
- core-schema.ts
- Design: Auth & Privacy-First Identity (`spec-01-auth-identity`)
- Requirements
- Expo App Icon & Splash Assets
- Milestones & Per-Spec Checklist
- MyCCS Claude Code Instructions
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
- identity-crypto.ts
- coderabbit-pr-gate.md
- Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)
- Requirements
- ADDED Requirements
- web-admin/package.json
- web-admin-scaffold.test.ts
- Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`)
- Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)
- compilerOptions
- shared/auth.ts
- web-admin.ts
- Design System: MyCCS
- app.js
- Product
- secure-store.verify.ts
- auth-identity.test.ts
- devDependencies
- scripts
- web-admin-guard.spec.ts
- metro.config.js
- SupabaseStorageAdapter
- dependencies
- Surface Brief: MyCCS Mobile Journey Prototype (Student + Org Officer)
- student/README.md
- MyCCS Web Admin (`web-admin/`)
- Development Placeholder Seeds (`supabase/development/`)

## God Nodes (most connected - your core abstractions)
1. `Product Requirements Document (PRD_MyCCS.md)` - 17 edges
2. `App()` - 16 edges
3. `Root AGENTS.md Guide` - 16 edges
4. `MyCCS Repository Rules (rules.md)` - 16 edges
5. `compilerOptions` - 15 edges
6. `CI/CD Pipeline Specification` - 15 edges
7. `AuthIdentityScreen()` - 13 edges
8. `Software Architecture Baseline (SCRUM-9)` - 13 edges
9. `Product` - 11 edges
10. `createSecureStoreAdapter()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Goals / Non-Goals` --references--> `AdminSessionState`  [INFERRED]
  openspec/changes/archive/2026-11-26-spec-03-web-admin-scaffold/design.md → shared/web-admin.ts
- `Implementation Bug Log` --references--> `PublicProfileDto`  [INFERRED]
  openspec/ROADMAP.md → shared/auth.ts
- `Implementation Bug Log` --references--> `formatWebAdminError()`  [INFERRED]
  openspec/ROADMAP.md → shared/web-admin.ts
- `Decisions` --references--> `resolveWebAdminRoute()`  [INFERRED]
  openspec/changes/archive/2026-11-26-spec-03-web-admin-scaffold/design.md → shared/web-admin.ts
- `Surfaces Touched` --references--> `AdminSessionState`  [INFERRED]
  openspec/changes/archive/2026-11-26-spec-03-web-admin-scaffold/design.md → shared/web-admin.ts

## Import Cycles
- None detected.

## Communities (55 total, 17 thin omitted)

### Community 0 - "MyCCS Product, Auth & Architecture"
Cohesion: 0.06
Nodes (57): Root AGENTS.md Guide, Shared Contracts (shared/), MyCCS Documentation Synchronization & Architecture Re-Baseline Brief, Docs Directory AGENTS.md Guide (docs/), Documentation SSOT Boundaries, Phase 0 Dependabot Maintenance (Root + web-admin/), CI/CD Pipeline Specification, Post-Merge CD Phases 4-5 (Expo EAS, Cloudflare Pages, Supabase) (+49 more)

### Community 1 - "package.json"
Cohesion: 0.12
Nodes (15): react, @supabase/supabase-js, @types/react, typescript, zod, main, name, private (+7 more)

### Community 2 - "Governance, CI/CD & Agent Guides"
Cohesion: 0.13
Nodes (11): DevSecOps Sentinel Agent, Jira-Git Workflow Agent, Postman API QA & Documentation Agent, React Native QA Specialist Agent, Jest Coverage Thresholds, Release Manager Agent, Supabase Architect Agent, Git Hygiene Rule (+3 more)

### Community 3 - "Expo App Config (app.json)"
Cohesion: 0.10
Nodes (19): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+11 more)

### Community 4 - "AuthIdentityScreen.tsx"
Cohesion: 0.18
Nodes (18): react-native, PublicProfileDto, toPublicProfileDto(), IdentityCard(), IdentityCardProps, styles, AuthIdentityScreen(), AuthIdentityScreenProps (+10 more)

### Community 5 - "core-schema.ts"
Cohesion: 0.08
Nodes (42): 1. Shared Core Schema Contracts & RBAC Helpers (`shared/`), UserRole, Announcement, AnnouncementCreateInput, AnnouncementCreateInputSchema, AnnouncementSchema, AnnouncementUpdateInput, AnnouncementUpdateInputSchema (+34 more)

### Community 6 - "Design: Auth & Privacy-First Identity (`spec-01-auth-identity`)"
Cohesion: 0.07
Nodes (26): 1. Server-Side `before-user-created` Auth Hook, 2. `public.profiles` Table Schema, 3. Explicit `GRANT`s & Row Level Security, 4. Encryption, Blind Index & Opaque QR Architecture, Context, Database Schema, RLS, Grants & Encryption, Decisions, Design: Auth & Privacy-First Identity (`spec-01-auth-identity`) (+18 more)

### Community 7 - "Requirements"
Cohesion: 0.07
Nodes (26): auth-identity Specification, Purpose, Requirement: Deterministic institutional email blind-index lookup, Requirement: Encrypted student profile provisioning and key versioning, Requirement: Mandatory 6-digit email OTP verification, Requirement: Permanent opaque QR token and student ID privacy, Requirement: Persistent mobile session storage, Requirement: Profile access control, role immutability, and admin bootstrapping (+18 more)

### Community 8 - "Expo App Icon & Splash Assets"
Cohesion: 0.47
Nodes (6): Android Adaptive Icon Background (Expo Blueprint Grid), Android Adaptive Icon Foreground (Blue Expo Chevron), Android Adaptive Icon Monochrome (Gray Expo Chevron), Web Favicon (Rounded Blue Expo Chevron), Primary App Icon (Composite Expo Chevron on Blueprint), Splash Screen Icon (Concentric Rings on Black Grid)

### Community 9 - "Milestones & Per-Spec Checklist"
Cohesion: 0.22
Nodes (9): Implementation Bug Log, Milestone 1 — Foundation, Auth & Security (Sprint 1), Milestone 2 — Org Hub, Media & GMetrix Distribution (Sprint 2), Milestone 3 — Events, Offline Attendance & Conditional Forms (Sprint 3), Milestone 4 — Hardening, QA & Production Cutover (Sprint 4), Milestones & Per-Spec Checklist, MyCCS OpenSpec SDD Roadmap, Spec Checklist & Bug Tracker, Ponytail Implementation Rules (Apply to Every Spec) (+1 more)

### Community 11 - "TypeScript Strict Config"
Cohesion: 0.29
Nodes (6): expo/tsconfig.base, compilerOptions, strict, types, exclude, extends

### Community 12 - "MyCCS Plugin Metadata"
Cohesion: 0.50
Nodes (3): description, name, $schema

### Community 15 - "src/lib/supabase.ts"
Cohesion: 0.20
Nodes (14): expo-secure-store, chunkCountKey(), chunkItemKey(), chunkUtf8(), createSecureStoreAdapter(), expoSecureStoreAdapter, isSupabaseConfigured(), parseChunkCount() (+6 more)

### Community 26 - "overrides"
Cohesion: 0.22
Nodes (9): minimatch, minimatch, minimatch, overrides, @expo/fingerprint, glob@10, glob@13, test-exclude@7 (+1 more)

### Community 27 - "ADDED Requirements"
Cohesion: 0.08
Nodes (26): ADDED Requirements, Purpose, Requirement: Deterministic institutional email blind-index lookup, Requirement: Encrypted student profile provisioning and key versioning, Requirement: Mandatory 6-digit email OTP verification, Requirement: Permanent opaque QR token and student ID privacy, Requirement: Persistent mobile session storage, Requirement: Profile access control, role immutability, and admin bootstrapping (+18 more)

### Community 28 - "identity-crypto.ts"
Cohesion: 0.13
Nodes (28): QrTokenSchema, bytesToHex(), computeEmailBlindIndex(), constantTimeEqual(), decodeByteaHex(), DecryptedPiiPayload, decryptPii(), encodeByteaHex() (+20 more)

### Community 30 - "Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)"
Cohesion: 0.07
Nodes (26): 1. Anti-Recursion RBAC Helpers (`SECURITY DEFINER`, `STABLE`, `SET search_path = public`), 2. Tables, Triggers & Explicit `GRANT`s, 3. RLS Policy Matrix, Context, Database Schema, RLS, Grants & Encryption, Decisions, Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`), Goals / Non-Goals (+18 more)

### Community 31 - "Requirements"
Cohesion: 0.08
Nodes (23): core-schema-rls Specification, Purpose, Requirement: Department Information Storage & Admin-Only Governance (`FR-DEPT-01`), Requirement: Mandatory Row Level Security & Explicit Grants (`ADR-005`), Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`), Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`), Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`), Requirements (+15 more)

### Community 32 - "ADDED Requirements"
Cohesion: 0.10
Nodes (21): ADDED Requirements, Requirement: Department Information Storage & Admin-Only Governance (`FR-DEPT-01`), Requirement: Mandatory Row Level Security & Explicit Grants (`ADR-005`), Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`), Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`), Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`), Scenario: Admin updates department information, Scenario: Anonymous caller accesses core tables (+13 more)

### Community 33 - "web-admin/package.json"
Cohesion: 0.05
Nodes (36): @fontsource/jetbrains-mono, @fontsource/public-sans, react-dom, @types/node, @types/react, @types/react-dom, typescript, vite (+28 more)

### Community 34 - "web-admin-scaffold.test.ts"
Cohesion: 0.15
Nodes (20): DepartmentInfoSchema, AdminProfileDtoSchema, WebAdminRouteSchema, appendVaryOrigin(), CorsResolution, DenoEnvGlobal, get(), getAllowedOriginsFromEnv() (+12 more)

### Community 35 - "Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`)"
Cohesion: 0.10
Nodes (20): Purpose, Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`), Requirement: Cloudflare Pages Root-Directory Deployment Configuration (`ADR-009`), Requirement: Fail-Closed Edge Function CORS Allowlist (`ADR-009`, `SAB §8`), Requirement: Shared TypeScript DTOs and Zod Contracts (`ADR-009`, `FR-AUTH-01`, `FR-CERT-02`), Requirement: Standalone Web Admin SPA Excluded from Mobile Bundle (`ADR-009`), Requirements, Scenario: Admin access evaluation enforces strict admin role (+12 more)

### Community 36 - "Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)"
Cohesion: 0.06
Nodes (32): Capabilities, Impact, Modified Capabilities, New Capabilities, Out of Scope, Proposal: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`), Why, ADDED Requirements (+24 more)

### Community 37 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+10 more)

### Community 38 - "shared/auth.ts"
Cohesion: 0.13
Nodes (18): INSTITUTIONAL_EMAIL_DOMAIN, OtpCodeSchema, ProfileProjectionInput, PublicProfileDtoSchema, RoleSchema, SignInRequest, SignInRequestSchema, SignupRequest (+10 more)

### Community 39 - "web-admin.ts"
Cohesion: 0.08
Nodes (44): Context, Core Data Shapes, Database Schema, RLS, Grants & Encryption, Decisions, Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`), Goals / Non-Goals, Migration Plan, Risks / Trade-offs (+36 more)

### Community 40 - "Design System: MyCCS"
Cohesion: 0.09
Nodes (21): Buttons, Colors, Components, Design System: MyCCS, Do:, Do's and Don'ts, Don't:, Elevation & Depth (+13 more)

### Community 41 - "app.js"
Cohesion: 0.22
Nodes (19): currentScreen(), escapeAttr(), escapeHtml(), formatEventOffset(), goTo(), hasOwnVariation(), isValidInstitutionalEmail(), isValidMeetingLink() (+11 more)

### Community 42 - "Product"
Cohesion: 0.17
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 43 - "secure-store.verify.ts"
Cohesion: 0.18
Nodes (6): encoder, Op, SimulatedCrash, summarizeSessionValue(), utf8Bytes(), SECURE_STORE_CHUNK_BYTES

### Community 44 - "auth-identity.test.ts"
Cohesion: 0.18
Nodes (11): App(), expo-status-bar, @testing-library/react-native, InstitutionalEmailSchema, isInstitutionalEmail(), normalizeInstitutionalEmail(), createMyCcsSupabaseClient(), getSupabaseClient() (+3 more)

### Community 45 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, husky, jest, jest-expo, jest-junit, @playwright/test, supabase, @testing-library/react-native (+3 more)

### Community 46 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, android, db:test, ios, prepare, start, test, test:e2e (+3 more)

### Community 47 - "web-admin-guard.spec.ts"
Cohesion: 0.24
Nodes (8): @playwright/test, createSyntheticAccessToken(), createSyntheticSessionPayload(), encodeBase64Url(), MockCounters, MockPersona, MockRouteOptions, setupSupabaseRoutes()

### Community 48 - "metro.config.js"
Cohesion: 0.25
Nodes (6): config, { getDefaultConfig }, path, webAdminAbsolutePattern, webAdminDir, expo

### Community 50 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, expo, expo-secure-store, expo-status-bar, react, react-native, @supabase/supabase-js, zod

### Community 54 - "MyCCS Web Admin (`web-admin/`)"
Cohesion: 0.33
Nodes (5): Architecture Boundaries, Cloudflare Pages Deployment, Local Development, MyCCS Web Admin (`web-admin/`), Verification

### Community 55 - "Development Placeholder Seeds (`supabase/development/`)"
Cohesion: 0.50
Nodes (3): Development Placeholder Seeds (`supabase/development/`), Placeholder Accounts, Usage

## Knowledge Gaps
- **31 isolated node(s):** `@types/node`, `@types/react`, `@types/react-dom`, `typescript`, `react` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 430 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MyCCS OpenSpec SDD Roadmap, Spec Checklist & Bug Tracker` connect `Milestones & Per-Spec Checklist` to `MyCCS Product, Auth & Architecture`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **What connects `@types/node`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MyCCS Product, Auth & Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.05789235639981909 - nodes in this community are weakly interconnected._
- **Why does `Implementation Bug Log` connect `Milestones & Per-Spec Checklist` to `AuthIdentityScreen.tsx`, `web-admin.ts`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `PublicProfileDto` connect `AuthIdentityScreen.tsx` to `Milestones & Per-Spec Checklist`, `web-admin-scaffold.test.ts`, `shared/auth.ts`, `web-admin.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Should `Governance, CI/CD & Agent Guides` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._