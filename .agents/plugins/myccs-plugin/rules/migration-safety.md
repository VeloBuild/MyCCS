---
trigger: glob
globs: ["supabase/migrations/*.sql"]
description: Enforce RLS policies, block unsafe destructive SQL, and validate migration ordering whenever a migration file is edited.
---

## Supabase Migration Safety

### 1. RLS required on every new table

Every `CREATE TABLE` statement must be accompanied in the same migration by:
- `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
- At least one `CREATE POLICY` statement for that table.

If either is absent, refuse to proceed and list what must be added.

### 2. Destructive SQL requires a checkpoint

Any of the following requires a `-- BACKUP CHECKPOINT` comment directly before it:
- `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`, `TRUNCATE`

### 3. auth.uid() in user-owned policies

Policies restricting a user to their own rows must use `auth.uid()` in the `USING` clause. Flag any policy using `USING (true)` on a table storing user data.

### 4. Timestamp ordering

Migration filenames must use `YYYYMMDDHHMMSS_description.sql`. Warn if the new file's timestamp is earlier than any existing migration.

### 5. Paired frontend reminder

After editing a migration file, always remind: **"Remember the Atomic Commit Rule — pair this migration with its React Native code change in the same commit."**
