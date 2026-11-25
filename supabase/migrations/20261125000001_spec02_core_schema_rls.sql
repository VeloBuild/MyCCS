-- spec-02-core-schema-rls (SCRUM-11): Core relational schema (department_info,
-- organizations, org_memberships, announcements), two-tier org hierarchy,
-- anti-recursion SECURITY DEFINER helpers, SECURITY INVOKER mutation guards,
-- mandatory RLS + FORCE RLS, 3-role RBAC policies, and explicit GRANTs.

-- 1. Core tables & indexes.

CREATE TABLE IF NOT EXISTS public.department_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) >= 1),
  about_markdown text NOT NULL DEFAULT '',
  leadership_json jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(leadership_json) = 'array'),
  contact_json jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(contact_json) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id uuid NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) >= 1),
  details text NOT NULL DEFAULT '',
  logo_url text NULL CHECK (logo_url IS NULL OR logo_url ~* '^https?://'),
  cover_url text NULL CHECK (cover_url IS NULL OR cover_url ~* '^https?://'),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT chk_organizations_no_self_parent CHECK (
    parent_org_id IS NULL OR parent_org_id <> id
  )
);

CREATE INDEX IF NOT EXISTS idx_organizations_parent_org_id
  ON public.organizations (parent_org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_unique_active_name
  ON public.organizations (
    COALESCE(parent_org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(name))
  )
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'officer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  -- shortcut: submission_id FK to public.form_submissions(id) ON DELETE SET NULL deferred to spec-07-conditional-forms-metrics
  submission_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_memberships_profile_org UNIQUE (profile_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_org_status_role
  ON public.org_memberships (organization_id, status, role);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) >= 1),
  content text NOT NULL CHECK (length(btrim(content)) >= 1),
  global_visibility boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  deleted_at timestamptz NULL,
  CONSTRAINT chk_announcements_expires_after_published CHECK (
    expires_at IS NULL OR expires_at > published_at
  ),
  CONSTRAINT chk_announcements_scope_valid CHECK (
    organization_id IS NOT NULL OR global_visibility = true
  )
);

CREATE INDEX IF NOT EXISTS idx_announcements_org_published_at
  ON public.announcements (organization_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_global_expires_at
  ON public.announcements (global_visibility, expires_at);

-- 2. Anti-recursion SECURITY DEFINER RBAC helpers.

CREATE OR REPLACE FUNCTION public.is_active_profile()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_officer(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND public.is_active_profile()
    AND EXISTS (
      SELECT 1
      FROM public.org_memberships m
      JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.profile_id = auth.uid()
        AND m.organization_id = p_org_id
        AND m.role = 'officer'
        AND m.status = 'approved'
        AND o.deleted_at IS NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_org_id IS NOT NULL
    AND public.is_active_profile()
    AND EXISTS (
      SELECT 1
      FROM public.org_memberships m
      JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.profile_id = auth.uid()
        AND m.organization_id = p_org_id
        AND m.status = 'approved'
        AND o.deleted_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_profile() TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_officer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_officer(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

-- 3. Timestamp & SECURITY INVOKER mutation guard triggers.

CREATE OR REPLACE FUNCTION public.set_department_info_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_department_info_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_department_info_updated_at ON public.department_info;
CREATE TRIGGER trg_department_info_updated_at
BEFORE UPDATE ON public.department_info
FOR EACH ROW
EXECUTE FUNCTION public.set_department_info_updated_at();

CREATE OR REPLACE FUNCTION public.guard_organizations_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_parent_parent_id uuid;
  v_parent_deleted_at timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND current_user = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.parent_org_id IS DISTINCT FROM OLD.parent_org_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Only Department Admins may modify organization hierarchy or lifecycle columns'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.deleted_at IS NULL
     AND NEW.deleted_at IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.organizations
       WHERE parent_org_id = NEW.id
         AND deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Cannot soft-delete a Main Organization that has active Sub-Organizations'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.deleted_at IS NULL AND NEW.parent_org_id IS NOT NULL THEN
    SELECT parent_org_id, deleted_at
      INTO v_parent_parent_id, v_parent_deleted_at
    FROM public.organizations
    WHERE id = NEW.parent_org_id
    FOR SHARE;

    IF NOT FOUND OR v_parent_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Parent organization must be an active Main Organization'
        USING ERRCODE = '23514';
    END IF;

    IF v_parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Three-level organization nesting is not allowed (Main Org -> Sub-Org only)'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' AND EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE parent_org_id = NEW.id
        AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot demote a Main Organization that has active Sub-Organizations'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_organizations_hierarchy() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_organizations_guard_hierarchy ON public.organizations;
CREATE TRIGGER trg_organizations_guard_hierarchy
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.guard_organizations_hierarchy();

CREATE OR REPLACE FUNCTION public.guard_org_memberships_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.role = 'officer' THEN
      RAISE EXCEPTION 'Only Department Admins may assign officer roles'
        USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF NEW.profile_id IS DISTINCT FROM auth.uid()
         OR NEW.role <> 'member'
         OR NEW.status <> 'pending' THEN
        RAISE EXCEPTION 'Non-admins may only submit pending member applications for themselves'
          USING ERRCODE = '42501';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.role <> 'member' THEN
        RAISE EXCEPTION 'Only Department Admins may modify officer membership rows'
          USING ERRCODE = '42501';
      END IF;

      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
         OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
         OR NEW.role IS DISTINCT FROM OLD.role
         OR NEW.submission_id IS DISTINCT FROM OLD.submission_id
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Cannot modify immutable membership columns directly'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_org_memberships_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_org_memberships_guard_mutation ON public.org_memberships;
CREATE TRIGGER trg_org_memberships_guard_mutation
BEFORE INSERT OR UPDATE ON public.org_memberships
FOR EACH ROW
EXECUTE FUNCTION public.guard_org_memberships_mutation();

CREATE OR REPLACE FUNCTION public.guard_announcements_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.global_visibility = true OR NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'Only Department Admins may manage department-wide or global announcements'
        USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF OLD.global_visibility = true THEN
        RAISE EXCEPTION 'Only Department Admins may manage department-wide or global announcements'
          USING ERRCODE = '42501';
      END IF;

      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'Cannot reassign announcement ownership'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_announcements_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_announcements_guard_mutation ON public.announcements;
CREATE TRIGGER trg_announcements_guard_mutation
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.guard_announcements_mutation();

-- 4. Mandatory Row Level Security, FORCE RLS, and explicit GRANT statements.

ALTER TABLE public.department_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_info FORCE ROW LEVEL SECURITY;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.department_info FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.organizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.org_memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.announcements FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.department_info TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.org_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.announcements TO authenticated;

-- 5. 3-Role RBAC RLS policies.

-- 5a. department_info
DROP POLICY IF EXISTS department_info_select_authenticated ON public.department_info;
CREATE POLICY department_info_select_authenticated
  ON public.department_info
  FOR SELECT
  TO authenticated
  USING (public.is_active_profile());

DROP POLICY IF EXISTS department_info_insert_admin ON public.department_info;
CREATE POLICY department_info_insert_admin
  ON public.department_info
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS department_info_update_admin ON public.department_info;
CREATE POLICY department_info_update_admin
  ON public.department_info
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS department_info_delete_admin ON public.department_info;
CREATE POLICY department_info_delete_admin
  ON public.department_info
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 5b. organizations
DROP POLICY IF EXISTS organizations_select_authenticated ON public.organizations;
CREATE POLICY organizations_select_authenticated
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR (public.is_active_profile() AND deleted_at IS NULL));

DROP POLICY IF EXISTS organizations_insert_admin ON public.organizations;
CREATE POLICY organizations_insert_admin
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS organizations_update_admin ON public.organizations;
CREATE POLICY organizations_update_admin
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS organizations_update_officer ON public.organizations;
CREATE POLICY organizations_update_officer
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.is_org_officer(id) AND deleted_at IS NULL)
  WITH CHECK (public.is_org_officer(id) AND deleted_at IS NULL);

-- 5c. org_memberships
DROP POLICY IF EXISTS org_memberships_select_authenticated ON public.org_memberships;
CREATE POLICY org_memberships_select_authenticated
  ON public.org_memberships
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_profile()
    AND (
      profile_id = auth.uid()
      OR public.is_org_officer(organization_id)
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS org_memberships_insert_admin ON public.org_memberships;
CREATE POLICY org_memberships_insert_admin
  ON public.org_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS org_memberships_insert_self_pending ON public.org_memberships;
CREATE POLICY org_memberships_insert_self_pending
  ON public.org_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_profile()
    AND profile_id = auth.uid()
    AND role = 'member'
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_id
        AND o.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS org_memberships_update_admin ON public.org_memberships;
CREATE POLICY org_memberships_update_admin
  ON public.org_memberships
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS org_memberships_update_officer ON public.org_memberships;
CREATE POLICY org_memberships_update_officer
  ON public.org_memberships
  FOR UPDATE
  TO authenticated
  USING (public.is_org_officer(organization_id) AND role = 'member')
  WITH CHECK (public.is_org_officer(organization_id) AND role = 'member');

DROP POLICY IF EXISTS org_memberships_delete_admin ON public.org_memberships;
CREATE POLICY org_memberships_delete_admin
  ON public.org_memberships
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS org_memberships_delete_self_pending ON public.org_memberships;
CREATE POLICY org_memberships_delete_self_pending
  ON public.org_memberships
  FOR DELETE
  TO authenticated
  USING (
    public.is_active_profile()
    AND profile_id = auth.uid()
    AND status = 'pending'
  );

-- 5d. announcements
DROP POLICY IF EXISTS announcements_select_authenticated ON public.announcements;
CREATE POLICY announcements_select_authenticated
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (organization_id IS NOT NULL AND public.is_org_officer(organization_id))
    OR (
      deleted_at IS NULL
      AND public.is_active_profile()
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        global_visibility = true
        OR (organization_id IS NOT NULL AND public.is_org_member(organization_id))
      )
    )
  );

DROP POLICY IF EXISTS announcements_insert_admin ON public.announcements;
CREATE POLICY announcements_insert_admin
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS announcements_insert_officer ON public.announcements;
CREATE POLICY announcements_insert_officer
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.is_org_officer(organization_id)
    AND global_visibility = false
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS announcements_update_admin ON public.announcements;
CREATE POLICY announcements_update_admin
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS announcements_update_officer ON public.announcements;
CREATE POLICY announcements_update_officer
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_org_officer(organization_id)
    AND global_visibility = false
    AND deleted_at IS NULL
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND public.is_org_officer(organization_id)
    AND global_visibility = false
  );
