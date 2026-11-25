# Specification: Standalone Web Admin Portal Scaffold (`web-admin-scaffold`)

## Purpose

Defines the standalone Web Admin portal isolation boundary, shared contract layer, admin-only authentication and route guard, Cloudflare Pages static deployment configuration, and fail-closed Edge Function CORS allowlist for MyCCS (`SCRUM-12`, `FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`, `ADR-009`).

## ADDED Requirements

### Requirement: Standalone Web Admin SPA Excluded from Mobile Bundle (`ADR-009`)
The system MUST host the faculty and admin web portal as a standalone Vite, React, and TypeScript (`strict: true`) single-page application in `web-admin/` that builds independently and is strictly excluded from Expo Metro and EAS mobile build bundles.

#### Scenario: Standalone web admin build succeeds without root mobile runtime code
- **WHEN** the `web-admin/` workspace runs strict TypeScript checking and a production build from the `web-admin/` directory
- **THEN** compilation and bundling succeed into `web-admin/dist/` using only `web-admin/` dependencies and pure TypeScript contracts from `shared/`

#### Scenario: Mobile Metro bundler and EAS archive exclude `web-admin/`
- **WHEN** Expo Metro resolves modules or EAS packages the repository for a mobile build
- **THEN** files under `web-admin/` are blocked from the Metro dependency graph and excluded from the EAS upload archive

### Requirement: Shared TypeScript DTOs and Zod Contracts (`ADR-009`, `FR-AUTH-01`, `FR-CERT-02`)
The system MUST expose pure TypeScript types and Zod validation schemas in `shared/` covering institutional authentication, web-admin environment configuration, strict admin profile projections, and route-access evaluation so mobile, web-admin, and backend checks share one contract without framework coupling.

#### Scenario: Client environment validation rejects backend secrets
- **WHEN** web-admin client environment configuration supplies a secret key (`sb_secret_*`) or a non-URL Supabase endpoint
- **THEN** schema validation rejects the configuration before any Supabase client is initialized

#### Scenario: Admin access evaluation enforces strict admin role
- **WHEN** an authenticated profile has role `student`, role `officer`, or no provisioned profile
- **THEN** access evaluation denies entry and reports the non-admin status without exposing private `student_id` data

### Requirement: Admin-Only Institutional Login and Route Guard (`FR-AUTH-01`, `FR-AUTH-02`, `FR-CERT-02`)
The `web-admin/` portal MUST require verified `@lpunetwork.edu.ph` institutional credentials, verify the signed-in user's server-side profile role, admit only active `role = 'admin'` profiles to protected admin routes, and block and sign out authenticated non-admin accounts.

#### Scenario: Unauthenticated visitor requests a protected admin route
- **WHEN** a browser without an active admin session opens `/` or any protected admin path
- **THEN** the route guard redirects the browser to `/login` and renders the institutional sign-in form without displaying admin dashboard content

#### Scenario: Non-institutional email is rejected before sign-in
- **WHEN** a user submits an email outside `@lpunetwork.edu.ph` on the admin login form
- **THEN** the portal rejects the submission with an institutional domain error and sends no authentication request

#### Scenario: Authenticated non-admin student is blocked from Web Admin
- **WHEN** a verified `@lpunetwork.edu.ph` user whose server-side profile has `role = 'student'` signs into `web-admin/`
- **THEN** the route guard blocks access to the admin dashboard, revokes the browser session, navigates to `/access-denied`, and displays an admin-only access denial message

#### Scenario: Authenticated non-admin officer is blocked from Web Admin
- **WHEN** a verified `@lpunetwork.edu.ph` user whose server-side profile has `role = 'officer'` signs into `web-admin/`
- **THEN** the route guard blocks access to the admin dashboard, revokes the browser session, and navigates to `/access-denied`

#### Scenario: Verified Department Admin enters and persists session
- **WHEN** a verified `@lpunetwork.edu.ph` user whose server-side profile has `role = 'admin'` signs into `web-admin/`
- **THEN** the portal admits the user to the protected admin dashboard, displays their institutional identity and admin role without `student_id`, preserves the PKCE session across page reloads, and returns to `/login` on sign-out

### Requirement: Cloudflare Pages Root-Directory Deployment Configuration (`ADR-009`)
The `web-admin/` directory MUST include Cloudflare Pages deployment configuration targeting `web-admin/` as root directory with `dist/` static output, strict browser security headers, SPA fallback compatibility, and zero backend secrets.

#### Scenario: Static deployment configuration declares public-only variables and security headers
- **WHEN** Cloudflare Pages builds and serves `web-admin/`
- **THEN** only public Supabase connection variables are referenced, no `404.html` overrides SPA routing fallback, and security headers restrict framing, MIME sniffing, referrer leakage, and search indexing

### Requirement: Fail-Closed Edge Function CORS Allowlist (`ADR-009`, `SAB §8`)
Supabase Edge Functions serving `web-admin/` MUST validate the HTTP `Origin` header against an explicit allowlist of configured origins, never emit a wildcard `Access-Control-Allow-Origin: *`, and reject disallowed origins fail-closed.

#### Scenario: Allowlisted Web Admin origin passes CORS preflight and responses
- **WHEN** a browser sends an `OPTIONS` preflight or API request with an `Origin` exactly matching an entry in the configured allowlist
- **THEN** the CORS helper returns `Access-Control-Allow-Origin` set to that exact origin, sets `Vary: Origin`, and answers `OPTIONS` preflight with `204 No Content`

#### Scenario: Disallowed or wildcard origin is rejected fail-closed
- **WHEN** an `OPTIONS` preflight arrives from an unlisted origin, or the allowlist configuration contains `*` or a malformed URL
- **THEN** allowlist parsing rejects the invalid configuration and preflight handling returns `403 Forbidden` without an `Access-Control-Allow-Origin` header
