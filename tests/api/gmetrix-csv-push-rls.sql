-- SQL/RLS Contract Verification for spec-05-gmetrix-csv-and-push (SCRUM-14)
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
      'myccs_qr_hmac_secret',
      'myccs_cert_key_encryption_key'
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

-- 1. Verify RLS + FORCE RLS on all 5 tables, exact GRANT/REVOKE matrix,
--    SECURITY INVOKER update guards, and RPC EXECUTE boundaries.
DO $$
DECLARE
  v_table text;
  v_rls_enabled boolean;
  v_rls_forced boolean;
  v_secdef boolean;
  v_trigger_count integer;
  v_fn text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'certifications',
    'certification_key_batches',
    'certification_keys',
    'notifications',
    'push_tokens'
  ]
  LOOP
    SELECT c.relrowsecurity, c.relforcerowsecurity
      INTO v_rls_enabled, v_rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = v_table;

    IF NOT COALESCE(v_rls_enabled, false) OR NOT COALESCE(v_rls_forced, false) THEN
      RAISE EXCEPTION 'RLS must be enabled and forced on public.%', v_table;
    END IF;

    IF has_table_privilege('anon', 'public.' || v_table, 'SELECT')
       OR has_table_privilege('anon', 'public.' || v_table, 'INSERT')
       OR has_table_privilege('anon', 'public.' || v_table, 'UPDATE')
       OR has_table_privilege('anon', 'public.' || v_table, 'DELETE') THEN
      RAISE EXCEPTION 'anon role must have zero privileges on public.%', v_table;
    END IF;

    IF has_table_privilege('public', 'public.' || v_table, 'SELECT')
       OR has_table_privilege('public', 'public.' || v_table, 'INSERT')
       OR has_table_privilege('public', 'public.' || v_table, 'UPDATE')
       OR has_table_privilege('public', 'public.' || v_table, 'DELETE') THEN
      RAISE EXCEPTION 'PUBLIC role must have zero privileges on public.%', v_table;
    END IF;
  END LOOP;

  -- Exact authenticated table privileges (each grant verified individually).
  IF NOT has_table_privilege('authenticated', 'public.certifications', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.certifications', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.certifications', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.certifications', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT, INSERT, UPDATE, and DELETE on public.certifications';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.certification_key_batches', 'SELECT')
     OR has_table_privilege('authenticated', 'public.certification_key_batches', 'INSERT')
     OR has_table_privilege('authenticated', 'public.certification_key_batches', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.certification_key_batches', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT only on public.certification_key_batches';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.certification_keys', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.certification_keys', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.certification_keys', 'INSERT')
     OR has_table_privilege('authenticated', 'public.certification_keys', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT and UPDATE only on public.certification_keys';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.notifications', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.notifications', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.notifications', 'INSERT')
     OR has_table_privilege('authenticated', 'public.notifications', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT and UPDATE only on public.notifications';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.push_tokens', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.push_tokens', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.push_tokens', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.push_tokens', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must have SELECT, INSERT, UPDATE, and DELETE on public.push_tokens';
  END IF;

  -- Verify all 3 guard trigger functions are SECURITY INVOKER and non-executable by PUBLIC/anon/authenticated.
  FOREACH v_fn IN ARRAY ARRAY[
    'guard_certification_keys_mutation',
    'guard_notifications_mutation',
    'guard_push_tokens_mutation'
  ]
  LOOP
    SELECT p.prosecdef
      INTO v_secdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = v_fn
      AND p.pronargs = 0;

    IF v_secdef IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'public.%() must be SECURITY INVOKER (prosecdef = false), got %', v_fn, v_secdef;
    END IF;

    IF has_function_privilege('public', 'public.' || v_fn || '()', 'EXECUTE')
       OR has_function_privilege('anon', 'public.' || v_fn || '()', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.' || v_fn || '()', 'EXECUTE') THEN
      RAISE EXCEPTION 'PUBLIC, anon, and authenticated must not have EXECUTE on public.%()', v_fn;
    END IF;
  END LOOP;

  SELECT count(*)
    INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
    AND (
      (c.relname = 'certification_keys' AND t.tgname = 'trg_certification_keys_guard_mutation')
      OR (c.relname = 'notifications' AND t.tgname = 'trg_notifications_guard_mutation')
      OR (c.relname = 'push_tokens' AND t.tgname = 'trg_push_tokens_guard_mutation')
    );

  IF v_trigger_count <> 3 THEN
    RAISE EXCEPTION 'Expected all 3 spec-05 mutation guard triggers, found %', v_trigger_count;
  END IF;

  -- Verify service_role-only RPCs.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.get_gmetrix_runtime_secrets(boolean, boolean)',
    'public.lookup_active_profiles_by_blind_indexes(text[])',
    'public.load_push_tokens_for_profiles(uuid[])',
    'public.delete_push_tokens_by_values(text[])',
    'public.commit_gmetrix_key_batch(uuid, uuid, integer, jsonb, text, text, text)'
  ]
  LOOP
    IF has_function_privilege('public', v_fn, 'EXECUTE')
       OR has_function_privilege('anon', v_fn, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'PUBLIC, anon, and authenticated must not have EXECUTE on %', v_fn;
    END IF;

    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'service_role must have EXECUTE on %', v_fn;
    END IF;
  END LOOP;

  IF has_function_privilege('public', 'public.get_pii_encryption_key_for_version(integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_pii_encryption_key_for_version(integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_pii_encryption_key_for_version(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC, anon, and authenticated must not have EXECUTE on public.get_pii_encryption_key_for_version(integer)';
  END IF;

  -- Verify authenticated RPCs are revoked from anon and PUBLIC.
  FOREACH v_fn IN ARRAY ARRAY[
    'public.register_push_token(text, text)',
    'public.list_admin_profiles()',
    'public.promote_faculty_by_email(text)'
  ]
  LOOP
    IF has_function_privilege('public', v_fn, 'EXECUTE')
       OR has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'PUBLIC and anon must not have EXECUTE on %', v_fn;
    END IF;

    IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated must have EXECUTE on %', v_fn;
    END IF;
  END LOOP;
END;
$$;

-- 2. End-to-end behavioral verification of RPCs, RLS isolation, mutation guards,
--    shared-device push token handover, admin listing, and faculty promotion.
DO $$
DECLARE
  v_student_a uuid := 'c5000000-0000-4000-8000-000000000001';
  v_student_b uuid := 'c5000000-0000-4000-8000-000000000002';
  v_officer_id uuid := 'c5000000-0000-4000-8000-000000000003';
  v_faculty_id uuid := 'c5000000-0000-4000-8000-000000000004';
  v_admin_id uuid := 'c5000000-0000-4000-8000-000000000005';
  v_deleted_student uuid := 'c5000000-0000-4000-8000-000000000006';
  v_deleted_admin uuid := 'c5000000-0000-4000-8000-000000000007';
  v_missing_profile uuid := 'c5000000-0000-4000-8000-000000000099';
  v_pii_key text;
  v_blind_pepper text;
  v_blind_a text;
  v_blind_deleted text;
  v_cert_active_id uuid;
  v_cert_inactive_id uuid;
  v_secrets_json jsonb;
  v_secrets_blind_only jsonb;
  v_secrets_cert_only jsonb;
  v_batch_first jsonb;
  v_batch_second jsonb;
  v_batch_deleted jsonb;
  v_batch_id uuid;
  v_key_a_id uuid;
  v_key_b_id uuid;
  v_notif_a_id uuid;
  v_notif_b_id uuid;
  v_token_a_json jsonb;
  v_token_b_json jsonb;
  v_admin_list jsonb;
  v_admin_entry jsonb;
  v_promote_first jsonb;
  v_promote_second jsonb;
  v_count integer;
  v_match_count integer;
  v_rows integer;
  v_deleted_count integer;
  v_blocked boolean;
  v_err_msg text;
  v_hash_a text := 'spec05_key_hash_alpha_0001';
  v_hash_b text := 'spec05_key_hash_beta_0002';
  v_hash_deleted text := 'spec05_key_hash_deleted_0003';
  v_hash_missing text := 'spec05_key_hash_missing_0004';
  v_shared_push_token text := 'ExponentPushToken[Spec05SharedDevice001]';
  v_prune_push_token text := 'ExponentPushToken[Spec05PruneToken00002]';
BEGIN
  v_pii_key := public.get_identity_secret('myccs_pii_encryption_key');
  v_blind_pepper := public.get_identity_secret('myccs_email_blind_pepper');
  v_blind_a := encode(
    extensions.hmac(convert_to('spec05.student.a@lpunetwork.edu.ph', 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'),
    'hex'
  );
  v_blind_deleted := encode(
    extensions.hmac(convert_to('spec05.deleted.student@lpunetwork.edu.ph', 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'),
    'hex'
  );

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (v_student_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec05.student.a@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_student_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec05.student.b@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_officer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec05.officer@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_faculty_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec05.faculty@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec05.admin@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_deleted_student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec05.deleted.student@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_deleted_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec05.deleted.admin@lpunetwork.edu.ph', 'hash', now(), '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (
    id, student_id_enc, full_name_enc, email_enc, email_blind_index, key_version, qr_token, role, deleted_at
  )
  VALUES
    (
      v_student_a,
      extensions.pgp_sym_encrypt('2026-0501', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('Spec05 Student Alpha', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('spec05.student.a@lpunetwork.edu.ph', v_pii_key, 'cipher-algo=aes256'),
      v_blind_a,
      1,
      'v1.' || v_student_a::text || '.000000000000000000000501',
      'student',
      NULL
    ),
    (
      v_student_b,
      extensions.pgp_sym_encrypt('2026-0502', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('Spec05 Student Beta', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('spec05.student.b@lpunetwork.edu.ph', v_pii_key, 'cipher-algo=aes256'),
      encode(extensions.hmac(convert_to('spec05.student.b@lpunetwork.edu.ph', 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'), 'hex'),
      1,
      'v1.' || v_student_b::text || '.000000000000000000000502',
      'student',
      NULL
    ),
    (
      v_officer_id,
      extensions.pgp_sym_encrypt('2026-0503', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('Spec05 Org Officer', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('spec05.officer@lpunetwork.edu.ph', v_pii_key, 'cipher-algo=aes256'),
      encode(extensions.hmac(convert_to('spec05.officer@lpunetwork.edu.ph', 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'), 'hex'),
      1,
      'v1.' || v_officer_id::text || '.000000000000000000000503',
      'officer',
      NULL
    ),
    (
      v_faculty_id,
      extensions.pgp_sym_encrypt('FAC-0504', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('Prof. Spec05 Faculty', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('spec05.faculty@lpunetwork.edu.ph', v_pii_key, 'cipher-algo=aes256'),
      encode(extensions.hmac(convert_to('spec05.faculty@lpunetwork.edu.ph', 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'), 'hex'),
      1,
      'v1.' || v_faculty_id::text || '.000000000000000000000504',
      'student',
      NULL
    ),
    (
      v_admin_id,
      extensions.pgp_sym_encrypt('ADM-0505', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('Spec05 Dept Admin', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('spec05.admin@lpunetwork.edu.ph', v_pii_key, 'cipher-algo=aes256'),
      encode(extensions.hmac(convert_to('spec05.admin@lpunetwork.edu.ph', 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'), 'hex'),
      1,
      'v1.' || v_admin_id::text || '.000000000000000000000505',
      'admin',
      NULL
    ),
    (
      v_deleted_student,
      extensions.pgp_sym_encrypt('2026-0506', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('Spec05 Deleted Student', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('spec05.deleted.student@lpunetwork.edu.ph', v_pii_key, 'cipher-algo=aes256'),
      v_blind_deleted,
      1,
      'v1.' || v_deleted_student::text || '.000000000000000000000506',
      'student',
      now()
    ),
    (
      v_deleted_admin,
      extensions.pgp_sym_encrypt('ADM-0507', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('Spec05 Deleted Admin', v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt('spec05.deleted.admin@lpunetwork.edu.ph', v_pii_key, 'cipher-algo=aes256'),
      encode(extensions.hmac(convert_to('spec05.deleted.admin@lpunetwork.edu.ph', 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'), 'hex'),
      1,
      'v1.' || v_deleted_admin::text || '.000000000000000000000507',
      'admin',
      now()
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.certifications (title, provider, description, is_active)
  VALUES ('Spec05 Active CompTIA Security+', 'CompTIA', 'Active test certification', true)
  RETURNING id INTO v_cert_active_id;

  INSERT INTO public.certifications (title, provider, description, is_active)
  VALUES ('Spec05 Archived Legacy Track', 'Cisco', 'Inactive test certification', false)
  RETURNING id INTO v_cert_inactive_id;

  -- Exercise service_role RPCs: selective get_gmetrix_runtime_secrets, lookup_active_profiles_by_blind_indexes,
  -- and commit_gmetrix_key_batch (active, duplicate, missing/soft-deleted profile, inactive cert, non-admin uploader).
  SET LOCAL ROLE service_role;

  v_secrets_json := public.get_gmetrix_runtime_secrets();
  IF length(COALESCE(v_secrets_json ->> 'emailBlindPepper', '')) = 0
     OR length(COALESCE(v_secrets_json ->> 'certKeyEncryptionKey', '')) = 0 THEN
    RAISE EXCEPTION 'get_gmetrix_runtime_secrets must return non-empty emailBlindPepper and certKeyEncryptionKey';
  END IF;

  v_secrets_blind_only := public.get_gmetrix_runtime_secrets(true, false);
  IF length(COALESCE(v_secrets_blind_only ->> 'emailBlindPepper', '')) = 0
     OR (v_secrets_blind_only -> 'certKeyEncryptionKey') IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'get_gmetrix_runtime_secrets(true, false) contract mismatch (emailBlindPepperPresent=%, certKeyEncryptionKeyIsNull=%)',
      length(COALESCE(v_secrets_blind_only ->> 'emailBlindPepper', '')) > 0,
      (v_secrets_blind_only -> 'certKeyEncryptionKey') IS NOT DISTINCT FROM 'null'::jsonb;
  END IF;

  v_secrets_cert_only := public.get_gmetrix_runtime_secrets(false, true);
  IF (v_secrets_cert_only -> 'emailBlindPepper') IS DISTINCT FROM 'null'::jsonb
     OR length(COALESCE(v_secrets_cert_only ->> 'certKeyEncryptionKey', '')) = 0 THEN
    RAISE EXCEPTION 'get_gmetrix_runtime_secrets(false, true) contract mismatch (emailBlindPepperIsNull=%, certKeyEncryptionKeyPresent=%)',
      (v_secrets_cert_only -> 'emailBlindPepper') IS NOT DISTINCT FROM 'null'::jsonb,
      length(COALESCE(v_secrets_cert_only ->> 'certKeyEncryptionKey', '')) > 0;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE id = v_student_a AND email_blind_index = v_blind_a)
    INTO v_count, v_match_count
  FROM public.lookup_active_profiles_by_blind_indexes(
    ARRAY[v_blind_a, v_blind_deleted, 'nonexistent_blind_index']
  );
  IF v_count IS DISTINCT FROM 1 OR v_match_count IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'lookup_active_profiles_by_blind_indexes must return exactly the 1 expected active profile (total=%, matched=%)', v_count, v_match_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lookup_active_profiles_by_blind_indexes(ARRAY[v_blind_deleted]);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'lookup_active_profiles_by_blind_indexes must exclude soft-deleted profiles, got %', v_count;
  END IF;

  v_batch_first := public.commit_gmetrix_key_batch(
    v_cert_active_id,
    v_admin_id,
    3,
    jsonb_build_array(
      jsonb_build_object(
        'student_profile_id', v_student_a,
        'key_code_enc_hex', '\x00000001deadbeefcafebabe0102030405060708090a0b0c0d0e0f1011121314',
        'key_code_hash', v_hash_a,
        'key_version', 1
      ),
      jsonb_build_object(
        'student_profile_id', v_student_b,
        'key_code_enc_hex', '\x00000001cafebabedeadbeef0102030405060708090a0b0c0d0e0f1011121315',
        'key_code_hash', v_hash_b,
        'key_version', 1
      )
    ),
    'GMetrix Key Ready',
    'Your GMetrix certification key is ready. Open MyCCS to view it.',
    'myccs://certifications/my-keys'
  );

  IF (v_batch_first ->> 'batchId') IS NULL
     OR (v_batch_first ->> 'assignedCount')::int IS DISTINCT FROM 2
     OR (v_batch_first ->> 'rejectedCount')::int IS DISTINCT FROM 1
     OR jsonb_array_length(v_batch_first -> 'committedHashes') IS DISTINCT FROM 2
     OR jsonb_array_length(v_batch_first -> 'missingProfileHashes') IS DISTINCT FROM 0
     OR jsonb_array_length(v_batch_first -> 'notifiedProfileIds') IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Unexpected first commit_gmetrix_key_batch response: %', v_batch_first;
  END IF;

  v_batch_id := (v_batch_first ->> 'batchId')::uuid;

  -- Duplicate re-upload idempotency: same hashes insert 0 keys and 0 duplicate notifications.
  v_batch_second := public.commit_gmetrix_key_batch(
    v_cert_active_id,
    v_admin_id,
    2,
    jsonb_build_array(
      jsonb_build_object(
        'student_profile_id', v_student_a,
        'key_code_enc_hex', '\x00000001deadbeefcafebabe0102030405060708090a0b0c0d0e0f1011121314',
        'key_code_hash', v_hash_a,
        'key_version', 1
      ),
      jsonb_build_object(
        'student_profile_id', v_student_b,
        'key_code_enc_hex', '\x00000001cafebabedeadbeef0102030405060708090a0b0c0d0e0f1011121315',
        'key_code_hash', v_hash_b,
        'key_version', 1
      )
    ),
    'GMetrix Key Ready',
    'Your GMetrix certification key is ready. Open MyCCS to view it.',
    'myccs://certifications/my-keys'
  );

  IF (v_batch_second ->> 'batchId') IS NULL
     OR (v_batch_second ->> 'assignedCount')::int IS DISTINCT FROM 0
     OR (v_batch_second ->> 'rejectedCount')::int IS DISTINCT FROM 2
     OR jsonb_array_length(v_batch_second -> 'committedHashes') IS DISTINCT FROM 0
     OR jsonb_array_length(v_batch_second -> 'missingProfileHashes') IS DISTINCT FROM 0
     OR jsonb_array_length(v_batch_second -> 'notifiedProfileIds') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Duplicate commit_gmetrix_key_batch must insert 0 keys and 0 notifications, got %', v_batch_second;
  END IF;

  -- Soft-deleted and nonexistent student profiles are skipped cleanly without FK 23503 or burning keys.
  v_batch_deleted := public.commit_gmetrix_key_batch(
    v_cert_active_id,
    v_admin_id,
    2,
    jsonb_build_array(
      jsonb_build_object(
        'student_profile_id', v_deleted_student,
        'key_code_enc_hex', '\x0000000111111111222222220102030405060708090a0b0c0d0e0f1011121316',
        'key_code_hash', v_hash_deleted,
        'key_version', 1
      ),
      jsonb_build_object(
        'student_profile_id', v_missing_profile,
        'key_code_enc_hex', '\x0000000133333333444444440102030405060708090a0b0c0d0e0f1011121317',
        'key_code_hash', v_hash_missing,
        'key_version', 1
      )
    ),
    'GMetrix Key Ready',
    'Your GMetrix certification key is ready. Open MyCCS to view it.',
    'myccs://certifications/my-keys'
  );

  IF (v_batch_deleted ->> 'batchId') IS NULL
     OR (v_batch_deleted ->> 'assignedCount')::int IS DISTINCT FROM 0
     OR (v_batch_deleted ->> 'rejectedCount')::int IS DISTINCT FROM 2
     OR jsonb_array_length(v_batch_deleted -> 'committedHashes') IS DISTINCT FROM 0
     OR jsonb_array_length(v_batch_deleted -> 'missingProfileHashes') IS DISTINCT FROM 2
     OR jsonb_array_length(v_batch_deleted -> 'notifiedProfileIds') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'commit_gmetrix_key_batch must skip soft-deleted/missing profiles cleanly, got %', v_batch_deleted;
  END IF;

  -- Inactive certification rejected with P0002.
  BEGIN
    PERFORM public.commit_gmetrix_key_batch(
      v_cert_inactive_id,
      v_admin_id,
      0,
      '[]'::jsonb,
      'GMetrix Key Ready',
      'Your GMetrix certification key is ready. Open MyCCS to view it.',
      'myccs://certifications/my-keys'
    );
    v_blocked := false;
  EXCEPTION WHEN no_data_found THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'commit_gmetrix_key_batch must reject inactive certification with P0002';
  END IF;

  -- Non-admin and soft-deleted admin uploaders rejected with 42501.
  BEGIN
    PERFORM public.commit_gmetrix_key_batch(
      v_cert_active_id,
      v_student_a,
      0,
      '[]'::jsonb,
      'GMetrix Key Ready',
      'Your GMetrix certification key is ready. Open MyCCS to view it.',
      'myccs://certifications/my-keys'
    );
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'commit_gmetrix_key_batch must reject non-admin uploader with 42501';
  END IF;

  BEGIN
    PERFORM public.commit_gmetrix_key_batch(
      v_cert_active_id,
      v_deleted_admin,
      0,
      '[]'::jsonb,
      'GMetrix Key Ready',
      'Your GMetrix certification key is ready. Open MyCCS to view it.',
      'myccs://certifications/my-keys'
    );
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'commit_gmetrix_key_batch must reject soft-deleted admin uploader with 42501';
  END IF;

  RESET ROLE;

  SELECT count(*) INTO v_count
  FROM public.certification_keys
  WHERE key_code_hash IN (v_hash_deleted, v_hash_missing);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Skipped missing/soft-deleted profile keys must not burn rows in certification_keys, found %', v_count;
  END IF;

  SELECT id INTO v_key_b_id
  FROM public.certification_keys
  WHERE student_profile_id = v_student_b;

  SELECT id INTO v_notif_b_id
  FROM public.notifications
  WHERE profile_id = v_student_b;

  SELECT count(*) INTO v_count
  FROM public.notifications
  WHERE profile_id IN (v_student_a, v_student_b)
    AND type = 'gmetrix_key';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected exactly 2 notifications after idempotent replay, found %', v_count;
  END IF;

  -- Switch to Student A: verify RLS reads, cross-user isolation, write blocks, and mutation guards.
  PERFORM set_config('request.jwt.claim.sub', v_student_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_count
  FROM public.certifications
  WHERE id = v_cert_active_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Student A must read active certifications, saw %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.certifications
  WHERE id = v_cert_inactive_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Student A must not read inactive certifications, saw %', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.certification_keys;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Student A must read only own certification_keys (1), saw %', v_count;
  END IF;

  SELECT id INTO v_key_a_id
  FROM public.certification_keys
  WHERE student_profile_id = v_student_a;

  SELECT count(*) INTO v_count
  FROM public.certification_keys
  WHERE student_profile_id = v_student_b;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Student A must not see Student B certification_keys';
  END IF;

  SELECT count(*) INTO v_count FROM public.notifications;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Student A must read only own notifications (1), saw %', v_count;
  END IF;

  SELECT id INTO v_notif_a_id
  FROM public.notifications
  WHERE profile_id = v_student_a;

  SELECT count(*) INTO v_count FROM public.certification_key_batches;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Student A must not read certification_key_batches, saw %', v_count;
  END IF;

  -- Direct INSERTs into certification_keys, certification_key_batches, notifications, certifications must fail (42501).
  BEGIN
    INSERT INTO public.certification_keys (
      batch_id, certification_id, student_profile_id, key_code_enc, key_code_hash, key_version
    )
    VALUES (v_batch_id, v_cert_active_id, v_student_a, '\x01'::bytea, 'forged_hash', 1);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student INSERT into certification_keys must fail with 42501';
  END IF;

  BEGIN
    INSERT INTO public.certification_key_batches (
      certification_id, uploaded_by_admin_id, total_rows, assigned_count, rejected_count
    )
    VALUES (v_cert_active_id, v_student_a, 1, 1, 0);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student INSERT into certification_key_batches must fail with 42501';
  END IF;

  BEGIN
    INSERT INTO public.notifications (profile_id, type, title, body, deep_link)
    VALUES (v_student_a, 'gmetrix_key', 'Forged', 'Forged body', 'myccs://certifications/my-keys');
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student INSERT into notifications must fail with 42501';
  END IF;

  BEGIN
    INSERT INTO public.certifications (title, provider)
    VALUES ('Unauthorized Cert', 'Evil Corp');
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student INSERT into certifications must fail with 42501';
  END IF;

  -- Student A marks own key viewed once; modifying immutable columns or clearing viewed_at fails (42501).
  UPDATE public.certification_keys
  SET viewed_at = now()
  WHERE id = v_key_a_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Student A setting viewed_at once must update 1 row, updated %', v_rows;
  END IF;

  BEGIN
    UPDATE public.certification_keys
    SET viewed_at = NULL
    WHERE id = v_key_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Clearing viewed_at on certification_keys must fail with 42501';
  END IF;

  BEGIN
    UPDATE public.certification_keys
    SET key_code_enc = '\xff'::bytea
    WHERE id = v_key_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Modifying immutable key_code_enc must fail with 42501';
  END IF;

  BEGIN
    UPDATE public.certification_keys
    SET key_code_hash = 'tampered_hash'
    WHERE id = v_key_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Modifying immutable key_code_hash must fail with 42501';
  END IF;

  -- Student A marks own notification read once; modifying immutable columns or clearing read_at fails (42501).
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = v_notif_a_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Student A setting read_at once must update 1 row, updated %', v_rows;
  END IF;

  BEGIN
    UPDATE public.notifications
    SET read_at = NULL
    WHERE id = v_notif_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Clearing read_at on notifications must fail with 42501';
  END IF;

  BEGIN
    UPDATE public.notifications
    SET title = 'Tampered Title'
    WHERE id = v_notif_a_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Modifying immutable notification title must fail with 42501';
  END IF;

  -- register_push_token for Student A, validation check, and shared-device handover to Student B.
  BEGIN
    PERFORM public.register_push_token('invalid-token', 'android');
    v_blocked := false;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'register_push_token must reject invalid Expo token format with 22023';
  END IF;

  v_token_a_json := public.register_push_token(v_shared_push_token, 'android');
  IF (v_token_a_json ->> 'id') IS NULL
     OR (v_token_a_json ->> 'expoPushToken') IS DISTINCT FROM v_shared_push_token
     OR (v_token_a_json ->> 'platform') IS DISTINCT FROM 'android'
     OR (v_token_a_json ->> 'updatedAt') IS NULL THEN
    RAISE EXCEPTION 'Unexpected register_push_token response for Student A: %', v_token_a_json;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.push_tokens
  WHERE expo_push_token = v_shared_push_token;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Student A must see registered own push token';
  END IF;

  -- guard_push_tokens_mutation blocks authenticated from mutating profile_id (42501).
  BEGIN
    UPDATE public.push_tokens
    SET profile_id = v_student_b
    WHERE expo_push_token = v_shared_push_token;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
    v_blocked := (v_err_msg LIKE '%Cannot modify immutable push_tokens columns directly%');
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'guard_push_tokens_mutation must block profile_id updates with 42501';
  END IF;

  -- Student A cannot UPDATE or DELETE Student B's certification_keys or notifications.
  UPDATE public.certification_keys
  SET viewed_at = now()
  WHERE id = v_key_b_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Student A must update 0 rows on Student B certification_keys, updated %', v_rows;
  END IF;

  BEGIN
    DELETE FROM public.certification_keys WHERE id = v_key_b_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student A DELETE on certification_keys must fail with 42501';
  END IF;

  UPDATE public.notifications
  SET read_at = now()
  WHERE id = v_notif_b_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Student A must update 0 rows on Student B notifications, updated %', v_rows;
  END IF;

  BEGIN
    DELETE FROM public.notifications WHERE id = v_notif_b_id;
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student A DELETE on notifications must fail with 42501';
  END IF;

  -- Student A cannot call service_role-only RPCs or admin-only RPCs.
  BEGIN
    PERFORM * FROM public.lookup_active_profiles_by_blind_indexes(ARRAY[v_blind_a]);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'authenticated calling lookup_active_profiles_by_blind_indexes must fail with 42501';
  END IF;

  BEGIN
    PERFORM * FROM public.load_push_tokens_for_profiles(ARRAY[v_student_a]);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'authenticated calling load_push_tokens_for_profiles must fail with 42501';
  END IF;

  BEGIN
    PERFORM public.delete_push_tokens_by_values(ARRAY[v_shared_push_token]);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'authenticated calling delete_push_tokens_by_values must fail with 42501';
  END IF;

  BEGIN
    PERFORM public.get_gmetrix_runtime_secrets(true, false);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'authenticated calling get_gmetrix_runtime_secrets must fail with 42501';
  END IF;
  BEGIN
    PERFORM public.list_admin_profiles();
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student calling list_admin_profiles must fail with 42501';
  END IF;

  BEGIN
    PERFORM public.promote_faculty_by_email('spec05.faculty@lpunetwork.edu.ph');
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Student calling promote_faculty_by_email must fail with 42501';
  END IF;

  -- Switch to Student B: verify push_tokens isolation before handover, then shared-device handover.
  PERFORM set_config('request.jwt.claim.sub', v_student_b::text, true);

  SELECT count(*) INTO v_count
  FROM public.push_tokens
  WHERE expo_push_token = v_shared_push_token;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Student B must not read Student A push token prior to handover';
  END IF;

  v_token_b_json := public.register_push_token(v_shared_push_token, 'ios');
  IF (v_token_b_json ->> 'id') IS NULL
     OR (v_token_b_json ->> 'expoPushToken') IS DISTINCT FROM v_shared_push_token
     OR (v_token_b_json ->> 'platform') IS DISTINCT FROM 'ios'
     OR (v_token_b_json ->> 'updatedAt') IS NULL THEN
    RAISE EXCEPTION 'Expected handed-over push token platform ios, got %', v_token_b_json;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.push_tokens
  WHERE expo_push_token = v_shared_push_token
    AND profile_id = v_student_b
    AND platform = 'ios';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Student B must own handed-over push token after register_push_token';
  END IF;

  -- Verify Student A no longer sees, updates, or deletes the handed-over push token owned by Student B.
  PERFORM set_config('request.jwt.claim.sub', v_student_a::text, true);
  SELECT count(*) INTO v_count
  FROM public.push_tokens
  WHERE expo_push_token = v_shared_push_token;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Student A must no longer see push token after handover to Student B';
  END IF;

  UPDATE public.push_tokens
  SET platform = 'web'
  WHERE expo_push_token = v_shared_push_token;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Student A must update 0 rows on Student B push_tokens, updated %', v_rows;
  END IF;

  DELETE FROM public.push_tokens
  WHERE expo_push_token = v_shared_push_token;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'Student A must delete 0 rows on Student B push_tokens, deleted %', v_rows;
  END IF;

  -- Register an extra token for Student A so service_role token-load and token-delete RPCs can be verified.
  PERFORM public.register_push_token(v_prune_push_token, 'android');

  -- Switch to soft-deleted Admin: verify admin-only RPCs fail with 42501.
  PERFORM set_config('request.jwt.claim.sub', v_deleted_admin::text, true);

  BEGIN
    PERFORM public.list_admin_profiles();
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Soft-deleted admin calling list_admin_profiles must fail with 42501';
  END IF;

  BEGIN
    PERFORM public.promote_faculty_by_email('spec05.faculty@lpunetwork.edu.ph');
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Soft-deleted admin calling promote_faculty_by_email must fail with 42501';
  END IF;

  -- Switch to Officer: verify admin-only RPCs fail with 42501.
  PERFORM set_config('request.jwt.claim.sub', v_officer_id::text, true);

  BEGIN
    PERFORM public.list_admin_profiles();
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer calling list_admin_profiles must fail with 42501';
  END IF;

  BEGIN
    PERFORM public.promote_faculty_by_email('spec05.faculty@lpunetwork.edu.ph');
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Officer calling promote_faculty_by_email must fail with 42501';
  END IF;

  -- Switch to Admin: verify list_admin_profiles (no student_id) and promote_faculty_by_email.
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);

  SELECT count(*) INTO v_count
  FROM public.certification_key_batches
  WHERE id = v_batch_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Admin must read certification_key_batches';
  END IF;

  v_admin_list := public.list_admin_profiles();
  IF jsonb_typeof(v_admin_list) IS DISTINCT FROM 'array' OR jsonb_array_length(v_admin_list) < 1 THEN
    RAISE EXCEPTION 'list_admin_profiles must return non-empty array for admin, got %', v_admin_list;
  END IF;

  FOR v_admin_entry IN
    SELECT value FROM jsonb_array_elements(v_admin_list)
  LOOP
    IF (v_admin_entry ->> 'role') IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'list_admin_profiles must include only admin rows, got %', v_admin_entry;
    END IF;
    IF v_admin_entry ? 'student_id' OR v_admin_entry ? 'studentId' THEN
      RAISE EXCEPTION 'list_admin_profiles must omit student_id, got %', v_admin_entry;
    END IF;
  END LOOP;

  -- Non-institutional email rejected with 22023.
  BEGIN
    PERFORM public.promote_faculty_by_email('external.user@gmail.com');
    v_blocked := false;
  EXCEPTION WHEN invalid_parameter_value THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'promote_faculty_by_email must reject non-@lpunetwork.edu.ph with 22023';
  END IF;

  -- Unregistered institutional email rejected with P0002.
  BEGIN
    PERFORM public.promote_faculty_by_email('missing.faculty@lpunetwork.edu.ph');
    v_blocked := false;
  EXCEPTION WHEN no_data_found THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'promote_faculty_by_email must reject missing account with P0002';
  END IF;

  -- Valid institutional faculty promotion + idempotent second call.
  v_promote_first := public.promote_faculty_by_email('  Spec05.Faculty@LPUNetwork.edu.ph  ');
  IF (v_promote_first ->> 'id')::uuid IS DISTINCT FROM v_faculty_id
     OR (v_promote_first ->> 'email') IS DISTINCT FROM 'spec05.faculty@lpunetwork.edu.ph'
     OR (v_promote_first ->> 'fullName') IS DISTINCT FROM 'Spec05 Faculty'
     OR (v_promote_first ->> 'role') IS DISTINCT FROM 'admin'
     OR (v_promote_first ->> 'alreadyAdmin')::boolean IS DISTINCT FROM false
     OR v_promote_first ? 'student_id'
     OR v_promote_first ? 'studentId' THEN
    RAISE EXCEPTION 'Unexpected first promote_faculty_by_email result: %', v_promote_first;
  END IF;

  v_promote_second := public.promote_faculty_by_email('spec05.faculty@lpunetwork.edu.ph');
  IF (v_promote_second ->> 'id')::uuid IS DISTINCT FROM v_faculty_id
     OR (v_promote_second ->> 'email') IS DISTINCT FROM 'spec05.faculty@lpunetwork.edu.ph'
     OR (v_promote_second ->> 'fullName') IS DISTINCT FROM 'Spec05 Faculty'
     OR (v_promote_second ->> 'role') IS DISTINCT FROM 'admin'
     OR (v_promote_second ->> 'alreadyAdmin')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Expected second promote_faculty_by_email to return alreadyAdmin = true, got %', v_promote_second;
  END IF;

  RESET ROLE;

  -- Verify service_role load_push_tokens_for_profiles and delete_push_tokens_by_values RPCs.
  SET LOCAL ROLE service_role;

  SELECT count(*) INTO v_count
  FROM public.load_push_tokens_for_profiles(ARRAY[v_student_a, v_student_b])
  WHERE expo_push_token IN (v_shared_push_token, v_prune_push_token);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'load_push_tokens_for_profiles must return both active tokens, got %', v_count;
  END IF;

  v_deleted_count := public.delete_push_tokens_by_values(ARRAY[v_prune_push_token]);
  IF v_deleted_count <> 1 THEN
    RAISE EXCEPTION 'delete_push_tokens_by_values must delete 1 token, deleted %', v_deleted_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.load_push_tokens_for_profiles(ARRAY[v_student_a, v_student_b])
  WHERE expo_push_token = v_prune_push_token;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Pruned push token must no longer be returned by load_push_tokens_for_profiles';
  END IF;

  RESET ROLE;

  -- Verify anon cannot execute service_role-only RPCs at runtime.
  SET LOCAL ROLE anon;

  BEGIN
    PERFORM * FROM public.lookup_active_profiles_by_blind_indexes(ARRAY[v_blind_a]);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'anon calling lookup_active_profiles_by_blind_indexes must fail with 42501';
  END IF;

  BEGIN
    PERFORM * FROM public.load_push_tokens_for_profiles(ARRAY[v_student_b]);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'anon calling load_push_tokens_for_profiles must fail with 42501';
  END IF;

  BEGIN
    PERFORM public.delete_push_tokens_by_values(ARRAY[v_shared_push_token]);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'anon calling delete_push_tokens_by_values must fail with 42501';
  END IF;

  BEGIN
    PERFORM public.get_gmetrix_runtime_secrets(false, true);
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'anon calling get_gmetrix_runtime_secrets must fail with 42501';
  END IF;

  RESET ROLE;
END;
$$;

ROLLBACK;
