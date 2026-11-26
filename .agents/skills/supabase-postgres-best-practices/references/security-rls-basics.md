---
title: Enable Row Level Security for Multi-Tenant Data
impact: CRITICAL
impactDescription: Database-enforced tenant isolation, prevent data leaks
tags: rls, row-level-security, multi-tenant, security
---

## Enable Row Level Security for Multi-Tenant Data

Row Level Security (RLS) enforces data access at the database level, ensuring users only see their own data.

**Incorrect (application-level filtering only):**

```sql
-- Relying only on application to filter
select * from orders where user_id = $current_user_id;

-- Bug or bypass means all data is exposed!
select * from orders;  -- Returns ALL orders
```

**Correct (database-enforced RLS):**

```sql
-- Assume orders.user_id is uuid referencing auth.users(id)
-- Enable RLS on the table
alter table orders enable row level security;

-- Create policy comparing against trusted authenticated identity from auth.uid()
-- (never trust client-settable session settings for authorization)
create policy orders_user_policy on orders
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Force RLS even for table owners
alter table orders force row level security;

-- Query as a non-superuser role without BYPASSRLS (e.g. authenticated)
-- so Postgres enforces the policy and returns only the signed-in user's orders
set local role authenticated;
select * from orders;
```

Updating an existing policy (drop or alter in place to avoid duplicate-policy errors):

```sql
drop policy if exists orders_user_policy on orders;
create policy orders_user_policy on orders
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

Reference: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
