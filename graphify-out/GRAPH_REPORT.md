# Graph Report - MyCCS  (2026-11-25)

## Corpus Check
- 70 files · ~60,778 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 11, .example 1, .toml 1)

## Summary
- 396 nodes · 591 edges · 30 communities (17 shown, 13 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ae32b2a7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MyCCS Product, Auth & Architecture
- package.json
- Governance, CI/CD & Agent Guides
- Expo App Config (app.json)
- auth-identity.test.ts
- Governance, CI/CD & Agent Guides
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
- dependencies

## God Nodes (most connected - your core abstractions)
1. `Product Requirements Document (PRD_MyCCS.md)` - 17 edges
2. `Root AGENTS.md Guide` - 16 edges
3. `MyCCS Repository Rules (rules.md)` - 16 edges
4. `CI/CD Pipeline Specification` - 15 edges
5. `AuthIdentityScreen()` - 13 edges
6. `Software Architecture Baseline (SCRUM-9)` - 13 edges
7. `expo` - 11 edges
8. `createSecureStoreAdapter()` - 10 edges
9. `Git Branching & Version Control Strategy` - 10 edges
10. `Standalone Vite+React SPA web-admin/ on Cloudflare Pages` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Implementation Bug Log` --references--> `PublicProfileDto`  [INFERRED]
  openspec/ROADMAP.md → shared/auth.ts
- `DevSecOps Sentinel Agent` --references--> `CI/CD Pipeline Specification`  [EXTRACTED]
  .github/agents/devsecops-sentinel.agent.md → docs/jira/CI_CD Pipeline Specification_ Centralized Department Mobile App.md
- `GitHub Actions Multi-Tiered DevSecOps CI/CD Pipeline` --implements--> `CI/CD Pipeline Specification`  [INFERRED]
  .github/workflows/ci.yml → docs/jira/CI_CD Pipeline Specification_ Centralized Department Mobile App.md
- `App()` --calls--> `AuthIdentityScreen()`  [EXTRACTED]
  App.tsx → src/screens/AuthIdentityScreen.tsx
- `IdentityCardProps` --references--> `PublicProfileDto`  [EXTRACTED]
  src/components/IdentityCard.tsx → shared/auth.ts

## Import Cycles
- None detected.

## Communities (30 total, 13 thin omitted)

### Community 0 - "MyCCS Product, Auth & Architecture"
Cohesion: 0.07
Nodes (47): Root AGENTS.md Guide, Shared Contracts (shared/), MyCCS Documentation Synchronization & Architecture Re-Baseline Brief, Docs Directory AGENTS.md Guide (docs/), Documentation SSOT Boundaries, Phase 0 Dependabot Maintenance (Root + web-admin/), CI/CD Pipeline Specification, Post-Merge CD Phases 4-5 (Expo EAS, Cloudflare Pages, Supabase) (+39 more)

### Community 1 - "package.json"
Cohesion: 0.06
Nodes (35): App(), devDependencies, husky, jest, jest-expo, jest-junit, supabase, @testing-library/react-native (+27 more)

### Community 2 - "Governance, CI/CD & Agent Guides"
Cohesion: 0.13
Nodes (11): DevSecOps Sentinel Agent, Jira-Git Workflow Agent, Postman API QA & Documentation Agent, React Native QA Specialist Agent, Jest Coverage Thresholds, Release Manager Agent, Supabase Architect Agent, Git Hygiene Rule (+3 more)

### Community 3 - "Expo App Config (app.json)"
Cohesion: 0.10
Nodes (19): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+11 more)

### Community 4 - "auth-identity.test.ts"
Cohesion: 0.08
Nodes (46): react-native, INSTITUTIONAL_EMAIL_DOMAIN, InstitutionalEmailSchema, isInstitutionalEmail(), normalizeInstitutionalEmail(), OtpCodeSchema, ProfileProjectionInput, PublicProfileDto (+38 more)

### Community 5 - "Governance, CI/CD & Agent Guides"
Cohesion: 0.29
Nodes (10): DevSecOps Sentinel Agent, React Native QA Specialist Agent, Release Manager Agent, CI Phase 3: Automated QA (Jest, Newman, Playwright), CI Phase 5: Production Deploy (Web Admin & Supabase), CI Phase 4: Expo EAS Build, CI Phase 1: Jira Ticket Validation, GitHub Actions Multi-Tiered DevSecOps CI/CD Pipeline (+2 more)

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
Cohesion: 0.13
Nodes (17): expo-secure-store, @supabase/supabase-js, chunkCountKey(), chunkItemKey(), chunkUtf8(), createSecureStoreAdapter(), expoSecureStoreAdapter, isSupabaseConfigured() (+9 more)

### Community 26 - "overrides"
Cohesion: 0.22
Nodes (9): minimatch, minimatch, minimatch, overrides, @expo/fingerprint, glob@10, glob@13, test-exclude@7 (+1 more)

### Community 27 - "ADDED Requirements"
Cohesion: 0.08
Nodes (26): ADDED Requirements, Purpose, Requirement: Deterministic institutional email blind-index lookup, Requirement: Encrypted student profile provisioning and key versioning, Requirement: Mandatory 6-digit email OTP verification, Requirement: Permanent opaque QR token and student ID privacy, Requirement: Persistent mobile session storage, Requirement: Profile access control, role immutability, and admin bootstrapping (+18 more)

### Community 28 - "identity-crypto.ts"
Cohesion: 0.17
Nodes (24): zod, QrTokenSchema, bytesToHex(), computeEmailBlindIndex(), constantTimeEqual(), decodeByteaHex(), DecryptedPiiPayload, decryptPii() (+16 more)

### Community 29 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, expo, expo-secure-store, expo-status-bar, react, react-native, @supabase/supabase-js, zod

## Knowledge Gaps
- **24 isolated node(s):** `@types/jest`, `@types/react`, `husky`, `jest`, `jest-expo` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 193 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MyCCS OpenSpec SDD Roadmap, Spec Checklist & Bug Tracker` connect `Milestones & Per-Spec Checklist` to `MyCCS Product, Auth & Architecture`?**
  _High betweenness centrality (0.157) - this node is a cross-community bridge._
- **What connects `@types/jest`, `@types/react`, `husky` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MyCCS Product, Auth & Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.06892230576441102 - nodes in this community are weakly interconnected._
- **Why does `PublicProfileDto` connect `auth-identity.test.ts` to `Milestones & Per-Spec Checklist`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.058029689608636977 - nodes in this community are weakly interconnected._
- **Why does `Implementation Bug Log` connect `Milestones & Per-Spec Checklist` to `auth-identity.test.ts`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Should `Governance, CI/CD & Agent Guides` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._