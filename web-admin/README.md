# MyCCS Web Admin (`web-admin/`)

Standalone Vite + React 19 + TypeScript (`strict: true`) portal for CCS Department Admins and Faculty (`ADR-009`, `SCRUM-12`).

## Architecture Boundaries

- **Isolated from Expo Mobile:** Excluded from Metro (`metro.config.js`), EAS uploads (`.easignore`), root `tsconfig.json`, and Jest unit test discovery (`jest.config.js`).
- **Shared Pure Contracts:** Imports only pure TypeScript/Zod contracts from `../shared/` (`@shared/*`), resolving `zod` from `web-admin/node_modules`.
- **Zero Backend Secrets:** Uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` validated by `WebAdminEnvSchema` (rejects `sb_secret_*` and `service_role` JWTs).
- **Admin-Only Route Guard:** Authenticates verified `@lpunetwork.edu.ph` credentials with Supabase PKCE (`window.sessionStorage`), checks server-side role via `public.get_my_profile()`, admits only `role = 'admin'`, and immediately signs out and redirects `student`, `officer`, or unprovisioned accounts to `/access-denied`.

## Local Development

```bash
cp .env.example .env.local
npm --prefix web-admin run dev
```

## Verification

```bash
npm --prefix web-admin run typecheck
npm --prefix web-admin run build
```

## Cloudflare Pages Deployment

- **Root directory:** `web-admin`
- **Build command:** `npm ci && npm run build`
- **Output directory:** `dist` (configured in `wrangler.jsonc`)
- **SPA Routing:** Do not add `public/404.html`; Cloudflare Pages automatically serves `/index.html` for `/login` and `/access-denied`.
- **Security Headers:** Enforced via `public/_headers`.
