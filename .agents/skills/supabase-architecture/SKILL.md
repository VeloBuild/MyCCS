---
name: supabase-architecture
description: Skill to audit Supabase SQL migrations, verify RLS policies, and diff schemas.
---

# Supabase Architecture Skill

This skill provides instructions for auditing Supabase database schemas and migrations.

## 1. Parse SQL Migrations
- Migrations are located in `supabase/migrations/*.sql`.
- Read the files using file tools.
- Identify `CREATE TABLE`, `ALTER TABLE`, and `CREATE POLICY` statements.

## 2. Verify RLS Policies
For every table identified:
- Check that `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;` exists in the same migration.
- Check that at least one `CREATE POLICY` is defined.
- Ensure policies restricting user data use `auth.uid() = user_id` in their `USING` clauses.
- Flag any use of `USING (true)` on tables containing sensitive user data.

## 3. Diff Schemas
To diff schemas safely:
- Use `supabase db diff` if the Supabase CLI is available locally.
- Review any destructive operations (`DROP TABLE`, `DROP COLUMN`). Ensure they are preceded by a `-- BACKUP CHECKPOINT` comment.
