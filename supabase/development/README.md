# Development Placeholder Seeds (`supabase/development/`)

Local-only SQL seeds for manually testing `web-admin/` authentication, `role = 'admin'` route guarding, and core CCS tables (`department_info`, `organizations`, `org_memberships`, `announcements`).

Files here run through `[db.seed].sql_paths` in `supabase/config.toml` during `npx supabase db reset`. They live outside `supabase/migrations/` so production `npx supabase db push` never applies test accounts or development passwords.

## Placeholder Accounts

All development accounts share local password `MyCCSDev!2026`.

| Email | Role | Expected `web-admin/` result |
| :--- | :--- | :--- |
| `dev.admin@lpunetwork.edu.ph` | `admin` | Admitted to `/` Admin Dashboard |
| `dev.faculty@lpunetwork.edu.ph` | `admin` | Admitted to `/` Admin Dashboard |
| `dev.officer@lpunetwork.edu.ph` | `officer` | Blocked at `/access-denied`, local session cleared |
| `dev.student@lpunetwork.edu.ph` | `student` | Blocked at `/access-denied`, local session cleared |
| `dev.unprovisioned@lpunetwork.edu.ph` | `unprovisioned` | Blocked at `/access-denied`, local session cleared |

## Usage

Run from the repository root:

```bash
npx supabase start
npx supabase db reset
npm --prefix web-admin run dev
```

To reset with only the production bootstrap seed (`supabase/seed.sql`) and skip development fixtures:

```bash
npx supabase db reset --sql-paths ./seed.sql
```
