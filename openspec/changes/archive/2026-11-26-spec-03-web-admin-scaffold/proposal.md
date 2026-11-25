# Proposal: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)

- **Jira Reference:** `SCRUM-12`
- **Roadmap Spec:** `spec-03-web-admin-scaffold` (Milestone 1, Foundation, Auth & Security, `openspec/ROADMAP.md`)
- **Owning Requirements:** `FR-AUTH` (`FR-AUTH-01`, `FR-AUTH-02`), `FR-CERT` (`FR-CERT-02`), `SAB §3.3`, `SAB §8`, `ADR-009`

## Why

MyCCS needs an isolated desktop portal for CCS faculty and Department Admins without inflating or coupling the Expo React Native mobile bundle. Landing the `web-admin/` Vite SPA scaffold, shared contracts, `role = 'admin'` route guard, Cloudflare Pages root-directory config, and fail-closed Edge Function CORS allowlist now completes Milestone 1 and unblocks GMetrix CSV distribution (`spec-05`) and public guest routes (`spec-06b`).

## What Changes

- Create a standalone Vite, React 19, and TypeScript (`strict: true`) SPA inside `web-admin/` with its own `package.json`, lockfile, and `tsconfig.json`.
- Exclude `web-admin/` strictly from the Expo mobile bundle via root `metro.config.js` (`resolver.blockList`), `.easignore`, root `tsconfig.json`, and `jest.config.js`.
- Add `shared/web-admin.ts` with Zod contracts (`WebAdminEnvSchema`, `AdminProfileDtoSchema`, `WebAdminRouteSchema`), a discriminated `AdminSessionState` model, pure `evaluateAdminAccess` and `resolveWebAdminRoute` functions, and a `shared/index.ts` export entry.
- Implement `@lpunetwork.edu.ph` admin login (PKCE `sessionStorage`), server-verified role checking via `rpc('get_my_profile')`, and an enforced `role = 'admin'` route guard that blocks and signs out non-admin `student` and `officer` accounts.
- Add Cloudflare Pages root-directory configuration (`web-admin/wrangler.jsonc`, `web-admin/public/_headers`, `web-admin/.env.example`, `web-admin/README.md`) with zero backend secrets on Cloudflare, and add local Vite dev redirect URLs to `supabase/config.toml`.
- Add a fail-closed Edge Function CORS allowlist helper in `supabase/functions/_shared/cors.ts` (strict origin matching, no wildcard `*`, `Vary: Origin`, `403` preflight rejection for disallowed origins).
- Add Jest unit tests (`tests/unit/web-admin-scaffold.test.ts`), root Playwright configuration (`playwright.config.ts`), and Playwright Chromium E2E smoke tests (`tests/e2e/web-admin-guard.spec.ts`) verifying non-admin `@lpunetwork.edu.ph` students and officers are blocked while admins enter the dashboard.
- Wire real Playwright E2E and `web-admin/` build checks in `.github/workflows/ci.yml` and add `web-admin/` to `.github/dependabot.yml`.

## Capabilities

### New Capabilities
- `web-admin-scaffold`: Isolated Vite + React + TypeScript `web-admin/` SPA excluded from mobile builds, shared web-admin Zod/DTO contracts, `role = 'admin'` authentication and route guard, Cloudflare Pages static deployment config with zero backend secrets, fail-closed Edge Function CORS allowlist, and Playwright E2E guard verification.

### Modified Capabilities
None. `auth-identity` and `core-schema-rls` requirements are unchanged. `web-admin/` reuses `public.get_my_profile()` and `shared/auth.ts`.

## Out of Scope

Per the MVP cutline (`docs/jira/PRD_MyCCS.md` §6) and roadmap sequencing:
- GMetrix CSV upload UI, `import-gmetrix-keys` Edge Function, and faculty-to-admin promotion UI (`spec-05-gmetrix-csv-and-push`).
- Department About and organization management screens (`spec-04-dept-and-org-pages`).
- Public guest pre-registration (`/e/:eventId`) and walk-in kiosk (`/e/:eventId/kiosk`) routes (`spec-06b-guest-passes`).
- Production Cloudflare Pages deployment secrets and live `Phase 5` cutover (`spec-08-qa-security-release`).
- Automated email notifications, live third-party certification APIs, and multi-campus expansion.

## Impact

- **Web Admin (`web-admin/`):** New standalone Vite + React + TypeScript SPA, Cloudflare Pages `wrangler.jsonc`, `public/_headers`, and `.env.example`.
- **Shared Contracts (`shared/`):** New `shared/web-admin.ts` and `shared/index.ts`.
- **Backend (`supabase/`):** New `supabase/functions/_shared/cors.ts` and Vite localhost redirect URLs in `supabase/config.toml`. No database migrations required.
- **Mobile Isolation & Tooling (root):** New `metro.config.js`, `.easignore`, `playwright.config.ts`; targeted updates to `tsconfig.json`, `jest.config.js`, `package.json`, `.github/workflows/ci.yml`, and `.github/dependabot.yml`.
- **Tests (`tests/`):** New `tests/unit/web-admin-scaffold.test.ts` and `tests/e2e/web-admin-guard.spec.ts`.
