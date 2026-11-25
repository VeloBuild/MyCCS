# Design: Standalone Web Admin Portal Scaffold (`spec-03-web-admin-scaffold`)

- **Jira Reference:** `SCRUM-12`
- **Roadmap Spec:** `spec-03-web-admin-scaffold` (`openspec/ROADMAP.md`)
- **Related Specs:** [proposal.md](./proposal.md), [specs/web-admin-scaffold/spec.md](./specs/web-admin-scaffold/spec.md)
- **Authoritative Architecture:** `docs/jira/Software_Architecture_Baseline.md` (§3.3, §5, §8, `ADR-009`)

## Context

See `proposal.md` for motivation (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`, `ADR-009`). `spec-01-auth-identity` already deployed `public.profiles` (encrypted PII, `role IN ('student', 'officer', 'admin')`, RLS + explicit `GRANT`s) and the `SECURITY DEFINER` RPC `public.get_my_profile()` (`GRANT EXECUTE` to `authenticated`, revoked from `PUBLIC` and `anon`). `web-admin/` must run as an independent Cloudflare Pages Vite SPA while reusing `shared/` contracts and zero backend secrets.

## Goals / Non-Goals

**Goals:**
- Stand up an isolated Vite + React 19 + TypeScript (`strict: true`) SPA inside `web-admin/` that builds cleanly even when root `node_modules/` is absent (Cloudflare Pages root directory `web-admin/`).
- Enforce mobile bundle exclusion in Expo Metro (`metro.config.js`), EAS uploads (`.easignore`), root `tsconfig.json`, and `jest.config.js`.
- Model web-admin authentication and route-guard state in `shared/web-admin.ts` using strict Zod schemas and a discriminated union (`AdminSessionState`) so non-admin authenticated states are unrepresentable.
- Enforce `role = 'admin'` via Supabase Auth PKCE `sessionStorage` + `rpc('get_my_profile')`, immediately signing out blocked non-admin sessions (`student`, `officer`, or unprovisioned) and routing them to `/access-denied`.
- Provide Cloudflare Pages configuration (`web-admin/wrangler.jsonc`, `web-admin/public/_headers`, `web-admin/.env.example`, `web-admin/README.md`) and a fail-closed Edge Function CORS allowlist helper (`supabase/functions/_shared/cors.ts`).
- Verify end-to-end in Chromium via Playwright (`tests/e2e/web-admin-guard.spec.ts`) and in CI (`Phase 3 · Playwright E2E Tests`).

**Non-Goals:**
- New PostgreSQL tables or migrations (zero schema changes; `web-admin/` reuses `spec-01`'s `public.get_my_profile()` and RLS policies).
- GMetrix CSV upload UI or `import-gmetrix-keys` Edge Function (`spec-05`).
- Public guest registration or kiosk routes (`/e/:eventId`, `/e/:eventId/kiosk` in `spec-06b`).

## Surfaces Touched

- **`shared/web-admin.ts` & `shared/index.ts`**: Pure Zod schemas (`WebAdminEnvSchema`, `AdminProfileDtoSchema`, `WebAdminRouteSchema`), `AdminSessionState` discriminated union, `evaluateAdminAccess`, and `resolveWebAdminRoute`.
- **`web-admin/`**:
  - `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `wrangler.jsonc`, `.env.example`, `README.md`
  - `public/_headers` (Cloudflare Pages security headers; no `404.html` so Cloudflare Pages SPA fallback routes `/login` and `/access-denied` to `/index.html`)
  - `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/lib/supabase.ts`, `src/services/adminAuth.ts`, `src/components/LoginView.tsx`, `src/components/AccessDeniedView.tsx`, `src/components/AdminDashboardShell.tsx`
- **`supabase/functions/_shared/cors.ts` & `supabase/config.toml`**: Fail-closed CORS allowlist helper for Deno 2 Edge Functions (and directly testable in Node/Jest) plus local Vite redirect URLs (`http://127.0.0.1:5173`, `http://localhost:5173`) in `supabase/config.toml`.
- **Root mobile isolation & CI/QA**:
  - `metro.config.js`, `.easignore`, `tsconfig.json`, `jest.config.js`, `package.json`, `package-lock.json`, `playwright.config.ts`
  - `.github/workflows/ci.yml` (wire real `web-admin` typecheck/build + Playwright Chromium E2E test; update stale Phase 5 Cloudflare Pages comment)
  - `.github/dependabot.yml` (monitor `web-admin/package.json` alongside root)
- **`tests/`**:
  - `tests/unit/web-admin-scaffold.test.ts` (Jest unit tests for `shared/web-admin.ts`, `supabase/functions/_shared/cors.ts`, `metro.config.js`, `.easignore`, and Cloudflare Pages security config)
  - `tests/e2e/web-admin-guard.spec.ts` (Playwright Chromium E2E smoke tests for unauthenticated redirect, non-institutional rejection, `@lpunetwork.edu.ph` student/officer blocking + session revocation, and admin sign-in/reload/sign-out)

## Database Schema, RLS, Grants & Encryption

No new database tables or columns are introduced in `spec-03-web-admin-scaffold`.
- Role verification calls `public.get_my_profile()` from `spec-01-auth-identity` (`SECURITY DEFINER`, `GRANT EXECUTE` restricted to `authenticated`, revoked from `PUBLIC` and `anon`, reading active `public.profiles` rows where `id = auth.uid() AND deleted_at IS NULL` and decrypting `email` and `fullName` via Vault without returning `student_id`).
- All PII encryption, blind-index, and RLS invariants from `spec-01` and `spec-02` remain untouched.

## Core Data Shapes

```ts
export type AdminProfileDto = PublicProfileDto & { role: 'admin' };

export type AdminSessionState =
  | { status: 'loading' }
  | { status: 'unauthenticated'; message?: string }
  | {
      status: 'forbidden';
      email: string;
      role: 'student' | 'officer' | 'unprovisioned';
      reason: string;
    }
  | { status: 'authenticated'; profile: AdminProfileDto };

export type WebAdminRoute = '/' | '/login' | '/access-denied';
```

## Decisions

1. **Zero-Router Pure Route Resolver (`resolveWebAdminRoute`) vs `react-router-dom`**
   - *Decision:* Keep route resolution as a pure function in `shared/web-admin.ts` paired with a thin `window.history` / `popstate` hook in `web-admin/src/App.tsx`.
   - *Rationale:* `spec-03` has three routes (`/`, `/login`, `/access-denied`). A pure resolver avoids adding router dependencies and React 19 peer-dependency churn, keeps all guard transitions unit-testable in Jest, and still exercises real History API URLs in Playwright.
   - *Alternative Considered:* Installing `react-router-dom` v7 upfront for future `spec-06b` guest routes — deferred until `spec-06b` adds parameterized public routes (`/e/:eventId`).

2. **Vite `zod` Alias + Restricted `server.fs.allow` for Standalone Cloudflare Pages Builds**
   - *Decision:* Configure `web-admin/vite.config.ts` with `resolve.alias: { '@shared': path.resolve(__dirname, '../shared'), zod: path.resolve(__dirname, 'node_modules/zod') }` and `server.fs.allow: [__dirname, path.resolve(__dirname, '../shared')]`, mirrored in `web-admin/tsconfig.json`.
   - *Rationale:* When Cloudflare Pages builds with Root Directory `web-admin/`, root `node_modules/` does not exist. Aliasing `zod` ensures `../shared/*.ts` resolves `zod` from `web-admin/node_modules`, while restricting `server.fs.allow` prevents the dev server from exposing root `.env` files.
   - *Alternative Considered:* Converting the repo into npm workspaces — rejected because `ADR-009` requires `web-admin/` to stay strictly isolated from the Expo mobile root workspace and EAS installs.

3. **Self-Contained Pure TypeScript `supabase/functions/_shared/cors.ts`**
   - *Decision:* Place the fail-closed CORS allowlist parser and header builder in `supabase/functions/_shared/cors.ts` using standard Web APIs (`URL`, `Headers`, `Request`, `Response`) with zero external imports and an optional `Deno.env` lookup fallback.
   - *Rationale:* `supabase functions deploy` bundles `supabase/functions/_shared/` cleanly without fragile relative imports outside `supabase/functions/`, and standard TypeScript lets Jest import and unit-test the exact production CORS module directly.
   - *Alternative Considered:* Duplicating CORS code between `shared/` and `supabase/functions/_shared/` — rejected to keep one source of truth.

4. **Immediate Session Revocation for Blocked Non-Admin Accounts**
   - *Decision:* When a verified `@lpunetwork.edu.ph` `student` or `officer` signs in (or restores an existing session) in `web-admin/`, `adminAuth.ts` evaluates `get_my_profile()`, immediately calls `supabase.auth.signOut()`, and transitions to `{ status: 'forbidden', ... }` at `/access-denied`.
   - *Rationale:* Prevents a non-admin JWT from lingering in browser `sessionStorage` while still giving the user a clear explanation that `web-admin/` is restricted to Department Admins and Faculty.

## Risks / Trade-offs

- **[`.easignore` Replaces `.gitignore` in EAS Builds]** → `.easignore` duplicates every rule from `.gitignore` plus `/web-admin/` and E2E artifacts, and a Jest test asserts `.easignore` keeps critical secret exclusions (`.env`, `*.key`, `*.pem`) and `/web-admin/`.
- **[Client-Only Route Guard Is UX Defense-in-Depth, Not Security Boundary]** → Server-side security remains enforced by PostgreSQL RLS (`is_admin()`), `public.get_my_profile()`, and future JWT/role-checking Edge Functions guarded by `supabase/functions/_shared/cors.ts`.
- **[Playwright E2E Mocks Supabase HTTP Endpoints Instead of Live Cloud Project]** → `shortcut: Playwright smoke test mocks Supabase Auth and get_my_profile RPC via page.route for deterministic CI runs without live credentials; upgrade in spec-08 to run an optional staging-backed E2E smoke check before v1.0.0 cutover`.

## Migration Plan

1. Commit `web-admin/`, `shared/web-admin.ts`, `shared/index.ts`, `supabase/functions/_shared/cors.ts`, `supabase/config.toml`, mobile isolation files (`metro.config.js`, `.easignore`, `tsconfig.json`, `jest.config.js`), Playwright config/tests, and CI/Dependabot updates atomically in the `SCRUM-12` PR targeting `develop`.
2. Rollback reverts the PR cleanly with zero database state changes.
