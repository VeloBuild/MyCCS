# Graph Report - MyCCS  (2026-11-25)

## Corpus Check
- 81 files · ~75,276 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 11, .example 1, .toml 1)

## Summary
- 528 nodes · 764 edges · 33 communities (20 shown, 13 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ff53a4bd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MyCCS Product, Auth & Architecture
- package.json
- Governance, CI/CD & Agent Guides
- Expo App Config (app.json)
- auth-identity.test.ts
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
- supabase.ts
- Branch Protection Script
- Skill Sync Script
- Dependabot Configuration
- OpenSpec Configuration
- overrides
- ADDED Requirements
- identity-crypto.ts
- devDependencies
- Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)
- Requirements
- ADDED Requirements

## God Nodes (most connected - your core abstractions)
1. `Product Requirements Document (PRD_MyCCS.md)` - 17 edges
2. `Root AGENTS.md Guide` - 16 edges
3. `MyCCS Repository Rules (rules.md)` - 16 edges
4. `CI/CD Pipeline Specification` - 15 edges
5. `AuthIdentityScreen()` - 13 edges
6. `Software Architecture Baseline (SCRUM-9)` - 13 edges
7. `expo` - 11 edges
8. `createSecureStoreAdapter()` - 11 edges
9. `Git Branching & Version Control Strategy` - 10 edges
10. `Standalone Vite+React SPA web-admin/ on Cloudflare Pages` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Implementation Bug Log` --references--> `PublicProfileDto`  [INFERRED]
  openspec/ROADMAP.md → shared/auth.ts
- `1. Shared Core Schema Contracts & RBAC Helpers (`shared/`)` --references--> `canManageDepartmentInfo()`  [INFERRED]
  openspec/changes/archive/2026-11-25-spec-02-core-schema-rls/tasks.md → shared/core-schema.ts
- `1. Shared Core Schema Contracts & RBAC Helpers (`shared/`)` --references--> `canManageOrganization()`  [INFERRED]
  openspec/changes/archive/2026-11-25-spec-02-core-schema-rls/tasks.md → shared/core-schema.ts
- `1. Shared Core Schema Contracts & RBAC Helpers (`shared/`)` --references--> `canReviewMembership()`  [INFERRED]
  openspec/changes/archive/2026-11-25-spec-02-core-schema-rls/tasks.md → shared/core-schema.ts
- `1. Shared Core Schema Contracts & RBAC Helpers (`shared/`)` --references--> `canPublishAnnouncement()`  [INFERRED]
  openspec/changes/archive/2026-11-25-spec-02-core-schema-rls/tasks.md → shared/core-schema.ts

## Import Cycles
- None detected.

## Communities (33 total, 13 thin omitted)

### Community 0 - "MyCCS Product, Auth & Architecture"
Cohesion: 0.06
Nodes (57): Root AGENTS.md Guide, Shared Contracts (shared/), MyCCS Documentation Synchronization & Architecture Re-Baseline Brief, Docs Directory AGENTS.md Guide (docs/), Documentation SSOT Boundaries, Phase 0 Dependabot Maintenance (Root + web-admin/), CI/CD Pipeline Specification, Post-Merge CD Phases 4-5 (Expo EAS, Cloudflare Pages, Supabase) (+49 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (34): App(), dependencies, expo, expo-secure-store, expo-status-bar, react, react-native, @supabase/supabase-js (+26 more)

### Community 2 - "Governance, CI/CD & Agent Guides"
Cohesion: 0.13
Nodes (11): DevSecOps Sentinel Agent, Jira-Git Workflow Agent, Postman API QA & Documentation Agent, React Native QA Specialist Agent, Jest Coverage Thresholds, Release Manager Agent, Supabase Architect Agent, Git Hygiene Rule (+3 more)

### Community 3 - "Expo App Config (app.json)"
Cohesion: 0.10
Nodes (19): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+11 more)

### Community 4 - "auth-identity.test.ts"
Cohesion: 0.09
Nodes (45): react-native, INSTITUTIONAL_EMAIL_DOMAIN, InstitutionalEmailSchema, isInstitutionalEmail(), normalizeInstitutionalEmail(), OtpCodeSchema, ProfileProjectionInput, PublicProfileDto (+37 more)

### Community 5 - "core-schema.ts"
Cohesion: 0.07
Nodes (43): 1. Shared Core Schema Contracts & RBAC Helpers (`shared/`), UserRole, Announcement, AnnouncementCreateInput, AnnouncementCreateInputSchema, AnnouncementSchema, AnnouncementUpdateInput, AnnouncementUpdateInputSchema (+35 more)

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
Cohesion: 0.33
Nodes (5): expo/tsconfig.base, compilerOptions, strict, types, extends

### Community 12 - "MyCCS Plugin Metadata"
Cohesion: 0.50
Nodes (3): description, name, $schema

### Community 15 - "supabase.ts"
Cohesion: 0.09
Nodes (22): expo-secure-store, @supabase/supabase-js, encoder, Op, SimulatedCrash, summarizeSessionValue(), utf8Bytes(), chunkCountKey() (+14 more)

### Community 26 - "overrides"
Cohesion: 0.22
Nodes (9): minimatch, minimatch, minimatch, overrides, @expo/fingerprint, glob@10, glob@13, test-exclude@7 (+1 more)

### Community 27 - "ADDED Requirements"
Cohesion: 0.08
Nodes (26): ADDED Requirements, Purpose, Requirement: Deterministic institutional email blind-index lookup, Requirement: Encrypted student profile provisioning and key versioning, Requirement: Mandatory 6-digit email OTP verification, Requirement: Permanent opaque QR token and student ID privacy, Requirement: Persistent mobile session storage, Requirement: Profile access control, role immutability, and admin bootstrapping (+18 more)

### Community 28 - "identity-crypto.ts"
Cohesion: 0.20
Nodes (22): bytesToHex(), computeEmailBlindIndex(), constantTimeEqual(), decodeByteaHex(), DecryptedPiiPayload, decryptPii(), encodeByteaHex(), encodeKeyVersionHeader() (+14 more)

### Community 29 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, husky, jest, jest-expo, jest-junit, supabase, @testing-library/react-native, @types/jest (+2 more)

### Community 30 - "Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`)"
Cohesion: 0.07
Nodes (26): 1. Anti-Recursion RBAC Helpers (`SECURITY DEFINER`, `STABLE`, `SET search_path = public`), 2. Tables, Triggers & Explicit `GRANT`s, 3. RLS Policy Matrix, Context, Database Schema, RLS, Grants & Encryption, Decisions, Design: Core Schema & 3-Role RBAC RLS (`spec-02-core-schema-rls`), Goals / Non-Goals (+18 more)

### Community 31 - "Requirements"
Cohesion: 0.08
Nodes (23): core-schema-rls Specification, Purpose, Requirement: Department Information Storage & Admin-Only Governance (`FR-DEPT-01`), Requirement: Mandatory Row Level Security & Explicit Grants (`ADR-005`), Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`), Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`), Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`), Requirements (+15 more)

### Community 32 - "ADDED Requirements"
Cohesion: 0.10
Nodes (21): ADDED Requirements, Requirement: Department Information Storage & Admin-Only Governance (`FR-DEPT-01`), Requirement: Mandatory Row Level Security & Explicit Grants (`ADR-005`), Requirement: Organization Membership Applications & Scoped Approval (`FR-ORG-03`), Requirement: Scoped Announcements with Expiration & Soft Delete (`FR-DEPT-02`, `FR-ORG-02`), Requirement: Two-Tier Organization Hierarchy (`FR-ORG-01`, `FR-ORG-02`), Scenario: Admin updates department information, Scenario: Anonymous caller accesses core tables (+13 more)

## Knowledge Gaps
- **24 isolated node(s):** `@types/jest`, `@types/react`, `husky`, `jest`, `jest-expo` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PublicProfileDto` connect `auth-identity.test.ts` to `Milestones & Per-Spec Checklist`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **What connects `@types/jest`, `@types/react`, `husky` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MyCCS Product, Auth & Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.05789235639981909 - nodes in this community are weakly interconnected._
- **Why does `MyCCS OpenSpec SDD Roadmap, Spec Checklist & Bug Tracker` connect `Milestones & Per-Spec Checklist` to `MyCCS Product, Auth & Architecture`?**
  _High betweenness centrality (0.146) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.059743954480796585 - nodes in this community are weakly interconnected._
- **Why does `Implementation Bug Log` connect `Milestones & Per-Spec Checklist` to `auth-identity.test.ts`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Should `Governance, CI/CD & Agent Guides` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._