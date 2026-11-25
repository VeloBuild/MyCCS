-- SQL/RLS Contract Verification for spec-01-auth-identity (SCRUM-10)
-- Run inside a rolled-back transaction against local/staging PostgreSQL after migrations + seed.

BEGIN;

-- Ensure test Vault secrets exist for the rolled-back transaction if not already seeded.
DO $$
DECLARE
  v_secret_name text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    FOREACH v_secret_name IN ARRAY ARRAY[
      'myccs_pii_encryption_key',
      'myccs_email_blind_pepper',
      'myccs_qr_hmac_secret'
    ]
    LOOP
      IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = v_secret_name) THEN
        PERFORM vault.create_secret(
          encode(extensions.gen_random_bytes(32), 'hex'),
          v_secret_name
        );
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- 1. Verify hook_restrict_signup_domain accepts @lpunetwork.edu.ph and rejects external domains.
DO $$
DECLARE
  v_accept jsonb;
  v_reject_gmail jsonb;
  v_reject_suffix jsonb;
BEGIN
  v_accept := public.hook_restrict_signup_domain(
    '{"user":{"email":"  Juan.DelaCruz@LPUNetwork.edu.ph  "}}'::jsonb
  );
  IF v_accept <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Expected empty hook response for valid institutional email, got %', v_accept;
  END IF;

  v_reject_gmail := public.hook_restrict_signup_domain(
    '{"user":{"email":"student@gmail.com"}}'::jsonb
  );
  IF (v_reject_gmail -> 'error' ->> 'http_code')::int <> 403 THEN
    RAISE EXCEPTION 'Expected 403 error for gmail domain, got %', v_reject_gmail;
  END IF;

  v_reject_suffix := public.hook_restrict_signup_domain(
    '{"user":{"email":"user@lpunetwork.edu.ph.evil.com"}}'::jsonb
  );
  IF (v_reject_suffix -> 'error' ->> 'http_code')::int <> 403 THEN
    RAISE EXCEPTION 'Expected 403 error for spoofed suffix domain, got %', v_reject_suffix;
  END IF;
END;
$$;

-- 2. Verify RLS enabled & forced on public.profiles, SECURITY INVOKER trigger guard, and strict explicit GRANT / REVOKE matrix.
DO $$
DECLARE
  v_rls_enabled boolean;
  v_rls_forced boolean;
  v_guard_secdef boolean;
  v_fn text;
BEGIN
  SELECT c.relrowsecurity, c.relforcerowsecurity
    INTO v_rls_enabled, v_rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profiles';

  IF NOT (v_rls_enabled AND v_rls_forced) THEN
    RAISE EXCEPTION 'RLS must be enabled and forced on public.profiles';
  END IF;

  SELECT p.prosecdef
    INTO v_guard_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'guard_profiles_immutable_columns'
    AND p.pronargs = 0;

  IF v_guard_secdef IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'public.guard_profiles_immutable_columns() must be SECURITY INVOKER (prosecdef = false), got %', v_guard_secdef;
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.profiles', 'SELECT, UPDATE') THEN
    RAISE EXCEPTION 'authenticated role must have explicit SELECT, UPDATE grants on public.profiles';
  END IF;

  IF has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     OR has_table_privilege('authenticated', 'public.profiles', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated role must not have direct INSERT or DELETE grants on public.profiles';
  END IF;

  IF has_table_privilege('anon', 'public.profiles', 'SELECT')
     OR has_table_privilege('anon', 'public.profiles', 'INSERT')
     OR has_table_privilege('anon', 'public.profiles', 'UPDATE')
     OR has_table_privilege('anon', 'public.profiles', 'DELETE') THEN
    RAISE EXCEPTION 'anon role must have zero privileges on public.profiles';
  END IF;

  IF NOT has_function_privilege('supabase_auth_admin', 'public.hook_restrict_signup_domain(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'supabase_auth_admin must have EXECUTE privilege on hook_restrict_signup_domain';
  END IF;

  IF has_function_privilege('authenticated', 'public.hook_restrict_signup_domain(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_identity_secret(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute hook_restrict_signup_domain or get_identity_secret';
  END IF;

  FOREACH v_fn IN ARRAY ARRAY[
    'public.hook_restrict_signup_domain(jsonb)',
    'public.get_identity_secret(text)',
    'public.current_user_role()',
    'public.is_admin()',
    'public.provision_profile(text, text)',
    'public.get_my_profile()',
    'public.promote_faculty_to_admin(uuid)'
  ]
  LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('public', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon and PUBLIC must not have EXECUTE privilege on %', v_fn;
    END IF;
  END LOOP;
END;
$$;

-- 3. Verify seeded admin, RPC provisioning/retrieval, cross-user isolation, immutable column guards,
--    student promotion denial, direct admin RLS SELECT/UPDATE, and soft-delete exclusion.
DO $$
DECLARE
  v_admin_id uuid;
  v_admin_role text;
  v_student_a uuid := '11111111-1111-4111-8111-111111111111';
  v_faculty_b uuid := '22222222-2222-4222-8222-222222222222';
  v_visible_count int;
  v_rows_updated int;
  v_profile_json jsonb;
  v_blocked boolean;
  v_promoted_role text;
BEGIN
  SELECT p.id, p.role
    INTO v_admin_id, v_admin_role
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = 'ccs.admin@lpunetwork.edu.ph'
    AND p.deleted_at IS NULL;

  IF v_admin_id IS NULL OR v_admin_role <> 'admin' THEN
    RAISE EXCEPTION 'Seeded Department Admin profile missing or invalid';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (v_student_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student.a@lpunetwork.edu.ph', 'test-hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_faculty_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'faculty.b@lpunetwork.edu.ph', 'test-hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', v_student_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  PERFORM public.provision_profile('Student Alpha', '2026-0001');
  v_profile_json := public.get_my_profile();
  IF v_profile_json ->> 'email' <> 'student.a@lpunetwork.edu.ph'
     OR v_profile_json ? 'studentId'
     OR v_profile_json ? 'student_id' THEN
    RAISE EXCEPTION 'get_my_profile must return verified email and exclude student_id, got %', v_profile_json;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_faculty_b::text, true);
  PERFORM public.provision_profile('Prof. Beta', 'FAC-0002');

  -- Switch back to Student A: verify cross-student SELECT & UPDATE isolation.
  PERFORM set_config('request.jwt.claim.sub', v_student_a::text, true);
  SELECT count(*) INTO v_visible_count FROM public.profiles;
  IF v_visible_count <> 1 THEN
    RAISE EXCEPTION 'Student should see exactly 1 own profile row, saw %', v_visible_count;
  END IF;

  UPDATE public.profiles SET full_name_enc = '\x00'::bytea WHERE id = v_faculty_b;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated <> 0 THEN
    RAISE EXCEPTION 'Student must not be able to update peer profile rows';
  END IF;

  -- Verify student cannot self-escalate role, tamper with qr_token/email_blind_index, or call promote_faculty_to_admin.
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = v_student_a;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student role escalation must fail with 42501';
  END IF;

  BEGIN
    UPDATE public.profiles SET qr_token = 'v1.' || v_student_a::text || '.000000000000000000000000' WHERE id = v_student_a;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student direct mutation of qr_token must fail with 42501';
  END IF;

  BEGIN
    UPDATE public.profiles SET email_blind_index = 'tampered' WHERE id = v_student_a;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student direct mutation of email_blind_index must fail with 42501';
  END IF;

  BEGIN
    PERFORM public.promote_faculty_to_admin(v_faculty_b);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student calling promote_faculty_to_admin must fail with 42501';
  END IF;

  -- Switch to seeded Department Admin: verify direct RLS SELECT/UPDATE (profiles_select_admin / profiles_update_admin).
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  SELECT count(*) INTO v_visible_count FROM public.profiles;
  IF v_visible_count < 3 THEN
    RAISE EXCEPTION 'Admin RLS select policy must see active profiles, saw %', v_visible_count;
  END IF;

  UPDATE public.profiles SET role = 'officer' WHERE id = v_faculty_b;
  SELECT role INTO v_promoted_role FROM public.profiles WHERE id = v_faculty_b;
  IF v_promoted_role <> 'officer' THEN
    RAISE EXCEPTION 'Expected direct admin RLS update to set role=officer, got %', v_promoted_role;
  END IF;

  PERFORM public.promote_faculty_to_admin(v_faculty_b);

  -- Verify soft-deleted profile is excluded from SELECT and rejected by provision_profile.
  RESET ROLE;
  UPDATE public.profiles SET deleted_at = now() WHERE id = v_student_a;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', v_student_a::text, true);
  SELECT count(*) INTO v_visible_count FROM public.profiles;
  IF v_visible_count <> 0 THEN
    RAISE EXCEPTION 'Soft-deleted profile must not be visible via SELECT';
  END IF;

  BEGIN
    PERFORM public.provision_profile('Student Alpha', '2026-0001');
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'provision_profile must reject soft-deleted profiles';
  END IF;

  RESET ROLE;
  SELECT role INTO v_promoted_role FROM public.profiles WHERE id = v_faculty_b;
  IF v_promoted_role <> 'admin' THEN
    RAISE EXCEPTION 'Expected Faculty B role to be admin after promotion, got %', v_promoted_role;
  END IF;
END;
$$;

ROLLBACK;
