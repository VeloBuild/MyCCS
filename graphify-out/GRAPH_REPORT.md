# Graph Report - MyCCS  (2026-11-23)

## Corpus Check
- 55 files · ~46,751 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 11, .toml 1)

## Summary
- 197 nodes · 247 edges · 27 communities (12 shown, 15 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2f12da52`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MyCCS Product, Auth & Architecture
- Expo App Entry & Manifest
- Governance, CI/CD & Agent Guides
- Expo App Config (app.json)
- MyCCS Product, Auth & Architecture
- Governance, CI/CD & Agent Guides
- Dev & Test Dependencies
- NPM Scripts & Commands
- Expo App Icon & Splash Assets
- Milestones & Per-Spec Checklist
- MyCCS Claude Code Instructions
- TypeScript Strict Config
- MyCCS Plugin Metadata
- Env Command Guard Hook
- Sensitive File Guard Hook
- Bounded Conditional Form Builder (JSONB + Zod)
- Branch Protection Script
- Skill Sync Script
- Dependabot Configuration
- OpenSpec Configuration

## God Nodes (most connected - your core abstractions)
1. `Product Requirements Document (PRD_MyCCS.md)` - 17 edges
2. `Root AGENTS.md Guide` - 16 edges
3. `MyCCS Repository Rules (rules.md)` - 16 edges
4. `CI/CD Pipeline Specification` - 15 edges
5. `Software Architecture Baseline (SCRUM-9)` - 13 edges
6. `expo` - 10 edges
7. `Git Branching & Version Control Strategy` - 10 edges
8. `Standalone Vite+React SPA web-admin/ on Cloudflare Pages` - 9 edges
9. `Agile Project Brief & Proposal` - 8 edges
10. `scripts` - 7 edges

## Surprising Connections (you probably didn't know these)
- `DevSecOps Sentinel Agent` --references--> `CI/CD Pipeline Specification`  [EXTRACTED]
  .github/agents/devsecops-sentinel.agent.md → docs/jira/CI_CD Pipeline Specification_ Centralized Department Mobile App.md
- `GitHub Actions Multi-Tiered DevSecOps CI/CD Pipeline` --implements--> `CI/CD Pipeline Specification`  [INFERRED]
  .github/workflows/ci.yml → docs/jira/CI_CD Pipeline Specification_ Centralized Department Mobile App.md
- `MyCCS Documentation Synchronization & Architecture Re-Baseline Brief` --cites--> `Software Architecture Baseline (SCRUM-9)`  [EXTRACTED]
  concepts_brief.md → docs/jira/Software_Architecture_Baseline.md
- `MyCCS Documentation Synchronization & Architecture Re-Baseline Brief` --references--> `Product Requirements Document (PRD_MyCCS.md)`  [EXTRACTED]
  concepts_brief.md → docs/jira/PRD_MyCCS.md
- `Jira-Git Workflow Agent` --references--> `Git Branching & Version Control Strategy`  [INFERRED]
  .github/agents/jira-git-workflow.agent.md → docs/jira/Git Branching & Version Control Strategy.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-Tiered DevSecOps CI/CD Gate Chain** — github_workflows_ci_jira_check, github_workflows_ci_static_analysis, github_workflows_ci_automated_qa, github_workflows_ci_eas_build, github_workflows_ci_deploy [EXTRACTED 1.00]
- **MyCCS Repository Rules & Directory AGENTS.md Governance Network** — agents_root_guide, rules_repo_rules, github_agents_guide, docs_agents_guide, scripts_agents_guide, supabase_agents_guide, tests_agents_guide [EXTRACTED 1.00]
- **Verified @lpunetwork.edu.ph Email+Password+OTP Auth & Admin Bootstrapping** — docs_jira_prd_myccs_fr_auth, docs_jira_software_architecture_baseline_before_user_created_hook, docs_jira_software_architecture_baseline_resend_smtp, docs_jira_prd_myccs_admin_bootstrapping, docs_jira_software_architecture_baseline_adr_011 [EXTRACTED 1.00]
- **Cloudflare Pages web-admin/ GMetrix CSV Key Distribution Pipeline** — docs_jira_software_architecture_baseline_web_admin_cloudflare, docs_jira_prd_myccs_gmetrix_csv_distribution, docs_jira_software_architecture_baseline_import_gmetrix_keys, docs_jira_software_architecture_baseline_pii_encryption_blind_index, docs_jira_software_architecture_baseline_content_free_expo_push [EXTRACTED 1.00]
- **MyCCS PR & Release Pipeline** — agents_plugins_myccs_plugin_agents_jira_git_workflow_agent, agents_plugins_myccs_plugin_rules_git_hygiene_rule, agents_plugins_myccs_plugin_rules_pr_cicd_gate_rule, agents_plugins_myccs_plugin_agents_release_manager_agent [INFERRED 0.85]
- **MyCCS Quality Assurance Gates** — agents_plugins_myccs_plugin_agents_react_native_qa_specialist_agent, agents_plugins_myccs_plugin_agents_postman_api_specialist_agent, agents_plugins_myccs_plugin_rules_pr_cicd_gate_rule [INFERRED 0.85]
- **MyCCS Security & Database Compliance Guardrails** — agents_plugins_myccs_plugin_agents_devsecops_sentinel_agent, agents_plugins_myccs_plugin_agents_supabase_architect_agent, agents_plugins_myccs_plugin_rules_migration_safety_rule, agents_plugins_myccs_plugin_rules_sensitive_file_guard_rule [INFERRED 0.85]
- **Expo Default App and Android Adaptive Icon Set** — assets_icon_primary_app_icon, assets_android_icon_background_layer, assets_android_icon_foreground_layer, assets_android_icon_monochrome_layer, assets_favicon_web_icon [INFERRED 0.95]

## Communities (27 total, 15 thin omitted)

### Community 0 - "MyCCS Product, Auth & Architecture"
Cohesion: 0.12
Nodes (31): Root AGENTS.md Guide, Docs Directory AGENTS.md Guide (docs/), Documentation SSOT Boundaries, Phase 0 Dependabot Maintenance (Root + web-admin/), CI/CD Pipeline Specification, PR CI Phases 1-3 (Jira, CodeQL/Snyk/CodeRabbit, Jest/Newman/Playwright), Agile Project Brief & Proposal, 4-Sprint Agile Delivery Roadmap (+23 more)

### Community 1 - "Expo App Entry & Manifest"
Cohesion: 0.09
Nodes (23): App(), styles, dependencies, expo, expo-status-bar, react, react-native, main (+15 more)

### Community 2 - "Governance, CI/CD & Agent Guides"
Cohesion: 0.13
Nodes (11): DevSecOps Sentinel Agent, Jira-Git Workflow Agent, Postman API QA & Documentation Agent, React Native QA Specialist Agent, Jest Coverage Thresholds, Release Manager Agent, Supabase Architect Agent, Git Hygiene Rule (+3 more)

### Community 3 - "Expo App Config (app.json)"
Cohesion: 0.11
Nodes (18): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+10 more)

### Community 4 - "MyCCS Product, Auth & Architecture"
Cohesion: 0.15
Nodes (13): Shared Contracts (shared/), Post-Merge CD Phases 4-5 (Expo EAS, Cloudflare Pages, Supabase), SQL-Seeded Admin Bootstrapping & Faculty Promotion, Web Admin GMetrix CSV Key Distribution, Offline-First Permanent QR Attendance, Edge Function: compress-image (EXIF Strip & WebP), Content-Free Expo Push Notifications, Edge Function: import-gmetrix-keys (+5 more)

### Community 5 - "Governance, CI/CD & Agent Guides"
Cohesion: 0.17
Nodes (12): MyCCS Documentation Synchronization & Architecture Re-Baseline Brief, RA 10173 PII Encryption, HMAC-SHA256 Blind Index & key_version Rotation, DevSecOps Sentinel Agent, React Native QA Specialist Agent, Release Manager Agent, CI Phase 3: Automated QA (Jest, Newman, Playwright), CI Phase 5: Production Deploy (Web Admin & Supabase), CI Phase 4: Expo EAS Build (+4 more)

### Community 6 - "Dev & Test Dependencies"
Cohesion: 0.22
Nodes (9): devDependencies, husky, jest, jest-expo, jest-junit, @testing-library/react-native, @types/jest, @types/react (+1 more)

### Community 7 - "NPM Scripts & Commands"
Cohesion: 0.29
Nodes (7): scripts, android, ios, prepare, start, test, web

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

## Knowledge Gaps
- **25 isolated node(s):** `react`, `@testing-library/react-native`, `@types/jest`, `@types/react`, `husky` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 109 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Product Requirements Document (PRD_MyCCS.md)` connect `MyCCS Product, Auth & Architecture` to `MyCCS Product, Auth & Architecture`, `Governance, CI/CD & Agent Guides`, `Bounded Conditional Form Builder (JSONB + Zod)`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `react`, `@testing-library/react-native`, `@types/jest` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MyCCS Product, Auth & Architecture` be split into smaller, more focused modules?**
  _Cohesion score 0.1226890756302521 - nodes in this community are weakly interconnected._
- **Why does `MyCCS Repository Rules (rules.md)` connect `MyCCS Product, Auth & Architecture` to `MyCCS Product, Auth & Architecture`, `Governance, CI/CD & Agent Guides`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `Expo App Entry & Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.08615384615384615 - nodes in this community are weakly interconnected._
- **Why does `CI/CD Pipeline Specification` connect `MyCCS Product, Auth & Architecture` to `MyCCS Product, Auth & Architecture`, `Governance, CI/CD & Agent Guides`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Governance, CI/CD & Agent Guides` be split into smaller, more focused modules?**
  _Cohesion score 0.1286549707602339 - nodes in this community are weakly interconnected._