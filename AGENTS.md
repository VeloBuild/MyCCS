# MyCCS Agent Instructions

## Project Shape

- **Mobile App (root):** Expo React Native app in TypeScript (`index.ts` registers `App.tsx`).
- **Web Admin (`web-admin/`):** Standalone Vite + React SPA for faculty/admin GMetrix CSV key distribution, deployed independently to Cloudflare Pages and excluded from the mobile bundle.
- **Shared Contracts (`shared/`):** Shared TypeScript types and Zod schemas.
- **Backend (`supabase/`):** PostgreSQL 17 (RLS + explicit `GRANT`s), `@lpunetwork.edu.ph` Email/Password/OTP Auth (server-side domain hook + Resend SMTP), Storage, and Deno 2 Edge Functions.

## Common Commands

- Start mobile app: `npm start`
- Run Android / iOS / Web: `npm run android` | `npm run ios` | `npm run web`
- Run unit tests: `npm test`

## Directory Guides & Rules

- Repo-wide rules: [rules.md](rules.md)
- Documentation SSOT: [docs/AGENTS.md](docs/AGENTS.md)
- Supabase backend & migrations: [supabase/AGENTS.md](supabase/AGENTS.md)
- Testing (Jest, Newman, Playwright): [tests/AGENTS.md](tests/AGENTS.md)
- Repo automation scripts: [scripts/AGENTS.md](scripts/AGENTS.md)
- GitHub workflows & agents: [.github/AGENTS.md](.github/AGENTS.md)

## Authoritative Docs

- [PRD (`docs/jira/PRD_MyCCS.md`)](docs/jira/PRD_MyCCS.md) for confirmed product requirements and MVP cutline.
- [Software Architecture Baseline (`SCRUM-9`)](docs/jira/Software_Architecture_Baseline.md) for system diagrams, ERD, RBAC, offline sync, encryption/blind index, and ADRs.
- [Agile Project Brief](docs/jira/College%20Department%20App%20-%20Agile%20Project%20Brief_Proposal.md) for stakeholder goals, SMART metrics, and 4-sprint plan.
- [CI/CD Pipeline Specification](docs/jira/CI_CD%20Pipeline%20Specification_%20Centralized%20Department%20Mobile%20App.md) for DevSecOps gates and post-merge CD.
- [Git Branching & Version Control Strategy](docs/jira/Git%20Branching%20%26%20Version%20Control%20Strategy.md) for `SCRUM-*` branches, Conventional Commits, and atomic commits.

## Editing Guidance

- Follow [rules.md](rules.md) and the directory-specific `AGENTS.md` before modifying files.
- Keep agent prompts, skill signatures, and hook contracts in sync across `.agents/` and `.github/agents/`.
- Link to the docs above instead of repeating their contents.
