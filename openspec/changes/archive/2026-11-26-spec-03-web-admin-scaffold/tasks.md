# Tasks: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)

- **Jira Reference:** `SCRUM-12`
- **Spec:** [specs/web-admin-scaffold/spec.md](./specs/web-admin-scaffold/spec.md)
- **Design:** [design.md](./design.md)

## 1. Shared Web-Admin Contracts & Edge Function CORS Allowlist (`shared/`, `supabase/`)

- [x] 1.1 Create `shared/web-admin.ts` and `shared/index.ts` defining `WebAdminEnvSchema`, `AdminProfileDtoSchema`, `WebAdminRouteSchema`, `AdminSessionState`, `evaluateAdminAccess`, and `resolveWebAdminRoute`; verify with focused unit tests in `tests/unit/web-admin-scaffold.test.ts` (`npm test -- tests/unit/web-admin-scaffold.test.ts` and `npx tsc --noEmit`).
- [x] 1.2 Create fail-closed Edge Function CORS allowlist helper `supabase/functions/_shared/cors.ts` (strict origin allowlist parsing, wildcard `*` rejection, `Vary: Origin`, `204` allowlisted preflight vs `403` disallowed preflight) and add local Vite redirect URLs to `supabase/config.toml`; verify CORS allow/reject paths with unit tests in `tests/unit/web-admin-scaffold.test.ts`.

## 2. Mobile Bundle Exclusion & Root Tooling Isolation

- [x] 2.1 Create root `metro.config.js` (`resolver.blockList` excluding `web-admin/`) and `.easignore` (preserving `.gitignore` secret rules plus excluding `/web-admin/` and E2E artifacts), and update root `tsconfig.json` and `jest.config.js` to isolate `web-admin/` and `tests/e2e/`; verify Metro blockList matching, `.easignore` rules, `npx tsc --noEmit`, and `npm test -- --ci`.

## 3. Standalone Vite + React SPA, Admin Login & Route Guard (`web-admin/`)

- [x] 3.1 Scaffold `web-admin/` (`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts` with `@shared` and `zod` alias plus restricted `server.fs.allow`, `index.html`, `wrangler.jsonc`, `public/_headers`, `.env.example`, `README.md`) and verify `npm --prefix web-admin run typecheck` and `npm --prefix web-admin run build` produce `web-admin/dist/`.
- [x] 3.2 Implement `web-admin/src/lib/supabase.ts` (PKCE `sessionStorage`, `WebAdminEnvSchema` guard), `web-admin/src/services/adminAuth.ts` (`signInWithPassword` + `rpc('get_my_profile')` + immediate `signOut` for non-admin sessions), and UI views (`App.tsx`, `LoginView.tsx`, `AccessDeniedView.tsx`, `AdminDashboardShell.tsx`, `styles.css`); verify `npm --prefix web-admin run build` succeeds with zero TypeScript errors.

## 4. Playwright E2E Smoke Tests, CI Integration & Audits (`tests/e2e/`, `.github/`)

- [x] 4.1 Add root `playwright.config.ts` and `tests/e2e/web-admin-guard.spec.ts` verifying unauthenticated redirect to `/login`, non-institutional email rejection, `@lpunetwork.edu.ph` student and officer blocking + session revocation at `/access-denied`, and `admin` sign-in, reload persistence, and sign-out; wire real `web-admin` build and Playwright execution in `.github/workflows/ci.yml` and monitor `web-admin/` in `.github/dependabot.yml`; verify `npx playwright test` passes in Chromium.
- [x] 4.2 Run full verification gates (`npx tsc --noEmit`, `npm test -- --coverage --ci`, `npm --prefix web-admin run build`, `npx playwright test`, `openspec validate spec-03-web-admin-scaffold --strict`), execute `ponytail-audit` and `no-comments` review, apply all accepted findings, and re-verify green.

## Workflow follow-up

- Archive `spec-03-web-admin-scaffold` via `openspec-archive-change` (sync main spec to `openspec/specs/web-admin-scaffold/spec.md`), check off `spec-03-web-admin-scaffold` and log any shortcut/bug entries in `openspec/ROADMAP.md`, and run `graphify update .`.
- Push `feat/SCRUM-12-spec-03-web-admin-scaffold`, open PR targeting `develop`, run `coderabbit-pr-gate` (`--wait`), apply all valid CodeRabbit findings until CI and CodeRabbit are green, and Squash & Merge into `develop`.
