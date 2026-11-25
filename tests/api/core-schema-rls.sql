-- SQL/RLS Contract Verification for spec-02-core-schema-rls (SCRUM-11)
-- Run inside a rolled-back transaction against local/staging PostgreSQL after migrations + seed.

BEGIN;

-- 1. Verify RLS + FORCE RLS, SECURITY DEFINER/INVOKER attributes, and strict explicit GRANT / REVOKE matrix.
DO $$
DECLARE
  v_table text;
  v_rls_enabled boolean;
  v_rls_forced boolean;
  v_secdef boolean;
  v_fn text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'department_info',
    'organizations',
    'org_memberships',
    'announcements'
  ]
  LOOP
    SELECT c.relrowsecurity, c.relforcerowsecurity
      INTO v_rls_enabled, v_rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_table;

    IF NOT (COALESCE(v_rls_enabled, false) AND COALESCE(v_rls_forced, false)) THEN
      RAISE EXCEPTION 'RLS must be enabled and forced on public.%', v_table;
    END IF;

    IF has_table_privilege('anon', 'public.' || v_table, 'SELECT')
       OR has_table_privilege('anon', 'public.' || v_table, 'INSERT')
       OR has_table_privilege('anon', 'public.' || v_table, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || v_table, 'DELETE')
       OR has_table_privilege('public', 'public.' || v_table, 'SELECT') THEN
      RAISE EXCEPTION 'anon and PUBLIC must have zero privileges on public.%', v_table;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated', 'public.department_info', 'SELECT, INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT, INSERT, UPDATE, DELETE on public.department_info';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.organizations', 'SELECT, INSERT, UPDATE')
     OR has_table_privilege('authenticated', 'public.organizations', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT, INSERT, UPDATE (and no DELETE) on public.organizations';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.org_memberships', 'SELECT, INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT, INSERT, UPDATE, DELETE on public.org_memberships';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.announcements', 'SELECT, INSERT, UPDATE')
     OR has_table_privilege('authenticated', 'public.announcements', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT, INSERT, UPDATE (and no DELETE) on public.announcements';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'guard_organizations_hierarchy',
    'guard_org_memberships_mutation',
    'guard_announcements_mutation'
  ]
  LOOP
    SELECT p.prosecdef
      INTO v_secdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_fn AND p.pronargs = 0;

    IF v_secdef IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'public.%() must be SECURITY INVOKER (prosecdef = false), got %', v_fn, v_secdef;
    END IF;
  END LOOP;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.is_active_profile()',
    'public.is_org_officer(uuid)',
    'public.is_org_member(uuid)'
  ]
  LOOP
    IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated must have EXECUTE on %', v_fn;
    END IF;

    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('public', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon and PUBLIC must not have EXECUTE on %', v_fn;
    END IF;
  END LOOP;
END;
$$;

-- 2. Verify end-to-end 3-role RBAC (anon, student, officer Org A vs Org B, admin) across all 4 tables.
DO $$
DECLARE
  v_admin_id uuid := 'a0000000-0000-4000-8000-000000000001';
  v_student_id uuid := 'a0000000-0000-4000-8000-000000000002';
  v_officer_a_id uuid := 'a0000000-0000-4000-8000-000000000003';
  v_deleted_student_id uuid := 'a0000000-0000-4000-8000-000000000004';
  v_officer_a2_id uuid := 'a0000000-0000-4000-8000-000000000005';
  v_dept_id uuid;
  v_org_a_id uuid;
  v_sub_org_a_id uuid;
  v_org_b_id uuid;
  v_membership_a_id uuid;
  v_membership_b_id uuid;
  v_officer_a2_membership_id uuid;
  v_ann_global_id uuid;
  v_ann_org_a_global_id uuid;
  v_ann_expired_id uuid;
  v_ann_deleted_id uuid;
  v_ann_org_a_id uuid;
  v_ann_org_b_id uuid;
  v_returned_id uuid;
  v_count int;
  v_rows int;
  v_blocked boolean;
BEGIN
  -- Seed isolated test identities (admin, student, officer_a, soft-deleted student, second officer_a).
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec02.admin@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_student_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec02.student@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_officer_a_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec02.officer@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_deleted_student_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec02.deleted@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_officer_a2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec02.officer2@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (
    id, student_id_enc, full_name_enc, email_enc, email_blind_index, key_version, qr_token, role, deleted_at
  )
  VALUES
    (v_admin_id, '\x01'::bytea, '\x01'::bytea, '\x01'::bytea, 'spec02-blind-admin', 1, 'v1.' || v_admin_id::text || '.000000000000000000000001', 'admin', NULL),
    (v_student_id, '\x02'::bytea, '\x02'::bytea, '\x02'::bytea, 'spec02-blind-student', 1, 'v1.' || v_student_id::text || '.000000000000000000000002', 'student', NULL),
    (v_officer_a_id, '\x03'::bytea, '\x03'::bytea, '\x03'::bytea, 'spec02-blind-officer', 1, 'v1.' || v_officer_a_id::text || '.000000000000000000000003', 'officer', NULL),
    (v_deleted_student_id, '\x04'::bytea, '\x04'::bytea, '\x04'::bytea, 'spec02-blind-deleted', 1, 'v1.' || v_deleted_student_id::text || '.000000000000000000000004', 'student', now()),
    (v_officer_a2_id, '\x05'::bytea, '\x05'::bytea, '\x05'::bytea, 'spec02-blind-officer2', 1, 'v1.' || v_officer_a2_id::text || '.000000000000000000000005', 'officer', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Act as Admin: manage department_info, organizations (Main + Sub-Org), and officer assignment.
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.department_info (title, about_markdown, leadership_json, contact_json)
  VALUES ('CCS Department', 'About CCS', '[{"name":"Dean","title":"Dean"}]'::jsonb, '{"office":"CCS 101"}'::jsonb)
  RETURNING id INTO v_dept_id;

  UPDATE public.department_info SET about_markdown = 'Updated CCS About' WHERE id = v_dept_id;

  INSERT INTO public.organizations (parent_org_id, name, details)
  VALUES (NULL, 'Spec02 Main Org A', 'Main Org A details')
  RETURNING id INTO v_org_a_id;

  INSERT INTO public.organizations (parent_org_id, name, details)
  VALUES (v_org_a_id, 'Spec02 Sub Org A1', 'Sub Org A1 details')
  RETURNING id INTO v_sub_org_a_id;

  INSERT INTO public.organizations (parent_org_id, name, details)
  VALUES (NULL, 'Spec02 Main Org B', 'Main Org B details')
  RETURNING id INTO v_org_b_id;

  -- Reject 3-level nesting (Sub-Org under Sub-Org A1).
  BEGIN
    INSERT INTO public.organizations (parent_org_id, name, details)
    VALUES (v_sub_org_a_id, 'Spec02 Invalid Level 3', 'Should fail');
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Three-level organization nesting must fail with check_violation (23514)';
  END IF;

  -- Reject self-parenting.
  BEGIN
    UPDATE public.organizations SET parent_org_id = v_org_b_id WHERE id = v_org_b_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Self-parenting organization must fail with check_violation (23514)';
  END IF;

  -- Reject demoting a Main Org that has active Sub-Orgs.
  BEGIN
    UPDATE public.organizations SET parent_org_id = v_org_b_id WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Demoting a Main Organization with active Sub-Organizations must fail with check_violation (23514)';
  END IF;

  -- Reject soft-deleting a Main Org that has active Sub-Orgs.
  BEGIN
    UPDATE public.organizations SET deleted_at = now() WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Soft-deleting a Main Organization with active Sub-Organizations must fail with check_violation (23514)';
  END IF;

  -- Reject javascript: URL in organizations.logo_url.
  BEGIN
    INSERT INTO public.organizations (parent_org_id, name, details, logo_url)
    VALUES (NULL, 'Spec02 Bad Logo URL Org', 'Invalid scheme', 'javascript:alert(1)');
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'javascript: logo_url must fail with check_violation (23514)';
  END IF;

  -- Admin soft-deletes Org B with RETURNING and restores it (deleted_at = NULL).
  UPDATE public.organizations SET deleted_at = now() WHERE id = v_org_b_id RETURNING id INTO v_returned_id;
  IF v_returned_id IS DISTINCT FROM v_org_b_id THEN
    RAISE EXCEPTION 'Admin soft-delete on organizations must succeed with RETURNING';
  END IF;

  UPDATE public.organizations SET deleted_at = NULL WHERE id = v_org_b_id RETURNING id INTO v_returned_id;
  IF v_returned_id IS DISTINCT FROM v_org_b_id THEN
    RAISE EXCEPTION 'Admin restore on organizations must succeed with RETURNING';
  END IF;

  -- Admin assigns officer_a and officer_a2 to Org A.
  INSERT INTO public.org_memberships (profile_id, organization_id, role, status)
  VALUES (v_officer_a_id, v_org_a_id, 'officer', 'approved');

  INSERT INTO public.org_memberships (profile_id, organization_id, role, status)
  VALUES (v_officer_a2_id, v_org_a_id, 'officer', 'approved')
  RETURNING id INTO v_officer_a2_membership_id;

  -- Admin creates global active, org-tied global, global expired, global soft-deleted, and Org B announcements.
  INSERT INTO public.announcements (organization_id, title, content, global_visibility, published_at, expires_at)
  VALUES (NULL, 'Spec02 Active Global', 'Visible to all', true, now() - interval '1 hour', now() + interval '1 day')
  RETURNING id INTO v_ann_global_id;

  INSERT INTO public.announcements (organization_id, title, content, global_visibility, published_at)
  VALUES (v_org_a_id, 'Spec02 Admin Global Tied To Org A', 'Admin-owned global announcement', true, now() - interval '1 hour')
  RETURNING id INTO v_ann_org_a_global_id;

  INSERT INTO public.announcements (organization_id, title, content, global_visibility, published_at, expires_at)
  VALUES (NULL, 'Spec02 Expired Global', 'Expired', true, now() - interval '2 days', now() - interval '1 hour')
  RETURNING id INTO v_ann_expired_id;

  INSERT INTO public.announcements (organization_id, title, content, global_visibility, published_at, deleted_at)
  VALUES (NULL, 'Spec02 Deleted Global', 'Soft deleted', true, now() - interval '1 hour', now())
  RETURNING id INTO v_ann_deleted_id;

  INSERT INTO public.announcements (organization_id, title, content, global_visibility)
  VALUES (v_org_b_id, 'Spec02 Org B Private', 'Org B members only', false)
  RETURNING id INTO v_ann_org_b_id;

  -- Admin soft-deletes announcement with RETURNING and restores it (deleted_at = NULL).
  UPDATE public.announcements SET deleted_at = now() WHERE id = v_ann_global_id RETURNING id INTO v_returned_id;
  IF v_returned_id IS DISTINCT FROM v_ann_global_id THEN
    RAISE EXCEPTION 'Admin soft-delete on announcements must succeed with RETURNING';
  END IF;

  UPDATE public.announcements SET deleted_at = NULL WHERE id = v_ann_global_id RETURNING id INTO v_returned_id;
  IF v_returned_id IS DISTINCT FROM v_ann_global_id THEN
    RAISE EXCEPTION 'Admin restore on announcements must succeed with RETURNING';
  END IF;

  -- Act as Soft-Deleted Profile: is_active_profile() = false must hide department_info, organizations, and announcements.
  PERFORM set_config('request.jwt.claim.sub', v_deleted_student_id::text, true);

  SELECT count(*) INTO v_count FROM public.department_info WHERE id = v_dept_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Soft-deleted profile must not read department_info';
  END IF;

  SELECT count(*) INTO v_count FROM public.organizations WHERE id = v_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Soft-deleted profile must not read organizations';
  END IF;

  SELECT count(*) INTO v_count FROM public.announcements WHERE id = v_ann_global_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Soft-deleted profile must not read announcements';
  END IF;

  -- Act as Student: read dept_info & orgs, denied writes on dept_info & orgs, apply to Org A & Org B.
  PERFORM set_config('request.jwt.claim.sub', v_student_id::text, true);

  SELECT count(*) INTO v_count FROM public.department_info WHERE id = v_dept_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Student must be able to read department_info';
  END IF;

  BEGIN
    UPDATE public.department_info SET title = 'Hacked' WHERE id = v_dept_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student must not be able to update department_info';
  END IF;

  -- Student applies to Org A and Org B as pending member.
  INSERT INTO public.org_memberships (profile_id, organization_id, role, status)
  VALUES (v_student_id, v_org_a_id, 'member', 'pending')
  RETURNING id INTO v_membership_a_id;

  INSERT INTO public.org_memberships (profile_id, organization_id, role, status)
  VALUES (v_student_id, v_org_b_id, 'member', 'pending')
  RETURNING id INTO v_membership_b_id;

  -- Student cannot self-approve or claim officer role.
  BEGIN
    INSERT INTO public.org_memberships (profile_id, organization_id, role, status)
    VALUES (v_student_id, v_sub_org_a_id, 'officer', 'approved');
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student self-approved/officer membership insert must fail with 42501';
  END IF;

  -- Student cannot self-approve own pending membership via UPDATE.
  BEGIN
    UPDATE public.org_memberships SET status = 'approved' WHERE id = v_membership_a_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student must not be able to self-approve own membership via UPDATE';
  END IF;

  -- Student withdraws own pending application for Org B.
  DELETE FROM public.org_memberships WHERE id = v_membership_b_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Student must be able to delete own pending membership';
  END IF;

  -- Act as Officer A: customize Org A, denied Org B / lifecycle columns, approve student in Org A, denied officer promotion / immutable edits / other officer row.
  PERFORM set_config('request.jwt.claim.sub', v_officer_a_id::text, true);

  UPDATE public.organizations SET details = 'Customized by Officer A' WHERE id = v_org_a_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Officer A must be able to update Org A details';
  END IF;

  UPDATE public.organizations SET details = 'Unauthorized edit' WHERE id = v_org_b_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Officer A must not be able to update Org B';
  END IF;

  BEGIN
    UPDATE public.organizations SET deleted_at = now() WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer A must not be able to soft-delete Org A';
  END IF;

  UPDATE public.org_memberships SET status = 'approved' WHERE id = v_membership_a_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Officer A must be able to approve pending member in Org A';
  END IF;

  BEGIN
    UPDATE public.org_memberships SET role = 'officer' WHERE id = v_membership_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer A must not be able to promote member to officer';
  END IF;

  BEGIN
    UPDATE public.org_memberships SET organization_id = v_org_b_id WHERE id = v_membership_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer A must not be able to mutate immutable organization_id on membership (42501)';
  END IF;

  BEGIN
    UPDATE public.org_memberships SET profile_id = v_officer_a_id WHERE id = v_membership_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer A must not be able to mutate immutable profile_id on membership (42501)';
  END IF;

  BEGIN
    UPDATE public.org_memberships SET status = 'rejected' WHERE id = v_officer_a2_membership_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer A must not be able to modify another officer membership row';
  END IF;

  -- Officer A publishes Org A announcement, rejected on global, Org B, or admin-published global announcement tied to Org A.
  INSERT INTO public.announcements (organization_id, title, content, global_visibility)
  VALUES (v_org_a_id, 'Spec02 Org A Event', 'Members of Org A', false)
  RETURNING id INTO v_ann_org_a_id;

  BEGIN
    UPDATE public.announcements SET title = 'Hijacked Global' WHERE id = v_ann_org_a_global_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer A must not be able to edit admin-published global announcement tied to Org A';
  END IF;

  BEGIN
    UPDATE public.announcements SET deleted_at = now() WHERE id = v_ann_org_a_global_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer A must not be able to soft-delete admin-published global announcement tied to Org A';
  END IF;

  BEGIN
    INSERT INTO public.announcements (organization_id, title, content, global_visibility)
    VALUES (NULL, 'Spec02 Officer Global Attempt', 'Should fail', true);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer must not be able to publish global announcement';
  END IF;

  BEGIN
    INSERT INTO public.announcements (organization_id, title, content, global_visibility)
    VALUES (v_org_b_id, 'Spec02 Cross-Org Attempt', 'Should fail', false);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer A must not be able to publish announcement for Org B';
  END IF;

  -- Act as Student (now approved member of Org A): verify announcement visibility filtering.
  PERFORM set_config('request.jwt.claim.sub', v_student_id::text, true);

  SELECT count(*) INTO v_count
  FROM public.announcements
  WHERE id IN (v_ann_global_id, v_ann_expired_id, v_ann_deleted_id, v_ann_org_a_id, v_ann_org_b_id);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Student should see exactly 2 announcements (active global + Org A), saw %', v_count;
  END IF;

  -- Approved student cannot delete their own approved membership.
  DELETE FROM public.org_memberships WHERE id = v_membership_a_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Student must not be able to delete approved membership';
  END IF;

  -- Officer A soft-deletes Org A announcement with RETURNING; it becomes hidden from Student SELECT.
  PERFORM set_config('request.jwt.claim.sub', v_officer_a_id::text, true);
  UPDATE public.announcements SET deleted_at = now() WHERE id = v_ann_org_a_id RETURNING id INTO v_returned_id;
  IF v_returned_id IS DISTINCT FROM v_ann_org_a_id THEN
    RAISE EXCEPTION 'Officer A must be able to soft-delete Org A announcement with RETURNING';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_student_id::text, true);
  SELECT count(*) INTO v_count FROM public.announcements WHERE id = v_ann_org_a_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Soft-deleted announcement must be hidden from Student SELECT';
  END IF;

  RESET ROLE;
END;
$$;

ROLLBACK;
