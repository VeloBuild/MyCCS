---
title: Optimize RLS Policies for Performance
impact: HIGH
impactDescription: 5-10x faster RLS queries with proper patterns
tags: rls, performance, security, optimization
---

## Optimize RLS Policies for Performance

Poorly written RLS policies can cause severe performance issues. Use subqueries and indexes strategically.

**Incorrect (function called for every row):**

```sql
create policy orders_policy on orders
  using (auth.uid() = user_id);  -- auth.uid() called per row!

-- With 1M rows, auth.uid() is called 1M times
```

**Correct (wrap functions in SELECT):**

```sql
create policy orders_policy on orders
  using ((select auth.uid()) = user_id);  -- Called once, cached

-- 100x+ faster on large tables
```

Use security definer functions for complex checks:

`SECURITY DEFINER` functions run with the creator's privileges and bypass RLS on any tables they touch — which is what makes them useful for internal lookups, but also what makes them dangerous if misused. Always include an explicit `auth.uid()` check inside the function body, keep them in a non-exposed schema, and revoke `EXECUTE` from any role that shouldn't call them directly.

```sql
-- Create an uncorrelated helper in a non-exposed private schema that returns
-- the calling user's team IDs once per query
create or replace function private.user_team_ids()
returns bigint[]
language sql
security definer
set search_path = ''
as $$
  select coalesce(array_agg(team_id), '{}')
  from public.team_members
  -- always check the calling user's identity inside the function
  where user_id = (select auth.uid());
$$;

-- Restrict EXECUTE to only the roles that evaluate the RLS policy
revoke execute on function private.user_team_ids() from PUBLIC, anon;
grant execute on function private.user_team_ids() to authenticated;

-- Use in policy (uncorrelated initPlan + indexed team_id lookup)
create policy team_orders_policy on orders
  to authenticated
  using (team_id = any ((select private.user_team_ids())));
```

Always add indexes on columns used in RLS policies:

```sql
create index orders_user_id_idx on orders (user_id);
```

Reference: [RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)
