# MyCCS Workflow, CI/CD & Spec Reference

## Required PR Checks (CI Phases 1–3)
- **Phase 1:** Jira Ticket Validation (`SCRUM-<number>` in PR title or branch)
- **Phase 2:** CodeRabbit AI Review, CodeQL SAST, Snyk SCA
- **Phase 3:** Jest Unit Tests, Newman API Tests, Playwright E2E Tests (`web-admin/`)

## Post-Merge CD (Phases 4–5 — `push` only)
- **`develop`:** Expo EAS staging `.apk`, Cloudflare Pages preview (`web-admin/`), Supabase staging migrations & Edge Functions.
- **`main`:** Supabase production migrations & Edge Functions (`compress-image`, `import-gmetrix-keys`), Cloudflare Pages production (`web-admin/`), Expo EAS production/OTA.

## Pre-Ship Checklist
- [ ] Branch matches `<type>/SCRUM-<N>-<kebab-case>` and commits pass `.husky/commit-msg`.
- [ ] Atomic commit includes client + `shared/` + `supabase/migrations/` (RLS + explicit `GRANT`s for `authenticated`) + `supabase/functions/`.
- [ ] RA 10173 privacy preserved: `student_id` private, opaque QR tokens, content-free push payloads, server-side `@lpunetwork.edu.ph` Auth Hook.
- [ ] `web-admin/` never imported into Expo mobile bundle.
- [ ] OpenSpec change (if used) cites `SCRUM-*` and `PRD_MyCCS.md` requirement IDs (`FR-*`).
- [ ] Graphify updated (`graphify update .`) after code edits; agent skill directories remain excluded via `.graphifyignore`.
