BEGIN;

DO $$
DECLARE
  v_public boolean;
  v_file_size_limit bigint;
  v_allowed_mime_types text[];
  v_select_policy_count integer;
  v_write_policy_count integer;
  v_secdef boolean;
  v_trigger_count integer;
BEGIN
  SELECT public, file_size_limit, allowed_mime_types
    INTO v_public, v_file_size_limit, v_allowed_mime_types
  FROM storage.buckets
  WHERE id = 'org-media';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'storage.buckets must contain org-media';
  END IF;

  IF v_public IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'org-media bucket must have public = true, got %', v_public;
  END IF;

  IF v_file_size_limit IS DISTINCT FROM 5242880 THEN
    RAISE EXCEPTION 'org-media bucket must enforce file_size_limit = 5242880, got %', v_file_size_limit;
  END IF;

  IF v_allowed_mime_types IS DISTINCT FROM ARRAY['image/webp']::text[] THEN
    RAISE EXCEPTION 'org-media bucket must allow only image/webp, got %', v_allowed_mime_types;
  END IF;

  SELECT count(*)
    INTO v_select_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'org_media_select_authenticated'
    AND cmd = 'SELECT'
    AND 'authenticated' = ANY(roles);

  IF v_select_policy_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 org_media_select_authenticated SELECT policy on storage.objects, found %', v_select_policy_count;
  END IF;

  SELECT count(*)
    INTO v_write_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    AND roles && ARRAY['public', 'anon', 'authenticated']::name[]
    AND (
      COALESCE(qual, '') ILIKE '%org-media%'
      OR COALESCE(with_check, '') ILIKE '%org-media%'
      OR COALESCE(qual, '') ILIKE '%org_media%'
      OR COALESCE(with_check, '') ILIKE '%org_media%'
      OR policyname ILIKE '%org_media%'
      OR policyname ILIKE '%org-media%'
      OR (
        cmd = 'INSERT'
        AND (
          with_check IS NULL
          OR lower(btrim(with_check)) IN ('', 'true')
          OR with_check NOT ILIKE '%bucket_id%'
        )
      )
      OR (
        cmd = 'DELETE'
        AND (
          qual IS NULL
          OR lower(btrim(qual)) IN ('', 'true')
          OR qual NOT ILIKE '%bucket_id%'
        )
      )
      OR (
        cmd IN ('UPDATE', 'ALL')
        AND (
          (qual IS NULL AND with_check IS NULL)
          OR lower(btrim(COALESCE(qual, ''))) = 'true'
          OR lower(btrim(COALESCE(with_check, ''))) = 'true'
          OR (
            COALESCE(qual, '') NOT ILIKE '%bucket_id%'
            AND COALESCE(with_check, '') NOT ILIKE '%bucket_id%'
          )
        )
      )
    );

  IF v_write_policy_count <> 0 THEN
    RAISE EXCEPTION 'storage.objects must have zero INSERT/UPDATE/DELETE/ALL policies allowing org-media writes for public/anon/authenticated, found %', v_write_policy_count;
  END IF;

  SELECT p.prosecdef
    INTO v_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'guard_organizations_media_urls'
    AND p.pronargs = 0;

  IF v_secdef IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'public.guard_organizations_media_urls() must be SECURITY INVOKER (prosecdef = false), got %', v_secdef;
  END IF;

  IF has_function_privilege('authenticated', 'public.guard_organizations_media_urls()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.guard_organizations_media_urls()', 'EXECUTE')
     OR has_function_privilege('public', 'public.guard_organizations_media_urls()', 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC, anon, and authenticated must not have EXECUTE on public.guard_organizations_media_urls()';
  END IF;

  SELECT count(*)
    INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'organizations'
    AND t.tgname = 'trg_organizations_guard_media_urls'
    AND NOT t.tgisinternal;

  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Expected trg_organizations_guard_media_urls trigger on public.organizations, found %', v_trigger_count;
  END IF;
END;
$$;

DO $$
DECLARE
  v_user_id uuid := 'b0000000-0000-4000-8000-000000000001';
  v_admin_id uuid := 'b0000000-0000-4000-8000-000000000002';
  v_org_a_id uuid;
  v_org_b_id uuid;
  v_logo_path text;
  v_cover_path text;
  v_org_b_logo_path text;
  v_logo_url text;
  v_cover_url text;
  v_org_b_logo_url text;
  v_missing_logo_url text;
  v_missing_cover_url text;
  v_rows integer;
  v_blocked boolean;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'spec04.officer@lpunetwork.edu.ph',
      'hash',
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'spec04.admin@lpunetwork.edu.ph',
      'hash',
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (
    id, student_id_enc, full_name_enc, email_enc, email_blind_index, key_version, qr_token, role, deleted_at
  )
  VALUES
    (
      v_user_id,
      '\x01'::bytea,
      '\x01'::bytea,
      '\x01'::bytea,
      'spec04-blind-officer',
      1,
      'v1.' || v_user_id::text || '.000000000000000000000010',
      'officer',
      NULL
    ),
    (
      v_admin_id,
      '\x02'::bytea,
      '\x02'::bytea,
      '\x02'::bytea,
      'spec04-blind-admin',
      1,
      'v1.' || v_admin_id::text || '.000000000000000000000011',
      'admin',
      NULL
    )
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.organizations (parent_org_id, name, details)
  VALUES (NULL, 'Spec04 Media Guard Org A', 'Org A for media URL guard')
  RETURNING id INTO v_org_a_id;

  INSERT INTO public.organizations (parent_org_id, name, details)
  VALUES (NULL, 'Spec04 Media Guard Org B', 'Org B for cross-org URL guard')
  RETURNING id INTO v_org_b_id;

  RESET ROLE;

  v_logo_path := 'orgs/' || v_org_a_id::text || '/logo/b0000000-0000-4000-8000-000000000030.webp';
  v_cover_path := 'orgs/' || v_org_a_id::text || '/cover/b0000000-0000-4000-8000-000000000031.webp';
  v_org_b_logo_path := 'orgs/' || v_org_b_id::text || '/logo/b0000000-0000-4000-8000-000000000034.webp';
  v_logo_url := 'https://myccs.supabase.co/storage/v1/object/public/org-media/' || v_logo_path;
  v_cover_url := 'https://myccs.supabase.co/storage/v1/object/public/org-media/' || v_cover_path;
  v_org_b_logo_url := 'https://myccs.supabase.co/storage/v1/object/public/org-media/' || v_org_b_logo_path;
  v_missing_logo_url := 'https://myccs.supabase.co/storage/v1/object/public/org-media/orgs/' || v_org_a_id::text || '/logo/b0000000-0000-4000-8000-000000000099.webp';
  v_missing_cover_url := 'https://myccs.supabase.co/storage/v1/object/public/org-media/orgs/' || v_org_a_id::text || '/cover/b0000000-0000-4000-8000-000000000098.webp';

  SET LOCAL ROLE service_role;

  BEGIN
    UPDATE public.organizations
    SET logo_url = v_missing_logo_url
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'service_role logo_url referencing non-existent storage.objects key must fail with check_violation (23514)';
  END IF;

  BEGIN
    UPDATE public.organizations
    SET cover_url = v_missing_cover_url
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'service_role cover_url referencing non-existent storage.objects key must fail with check_violation (23514)';
  END IF;

  RESET ROLE;

  INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES
    ('org-media', v_logo_path, v_user_id),
    ('org-media', v_cover_path, v_user_id),
    ('org-media', v_org_b_logo_path, v_user_id);

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner)
    VALUES (
      'org-media',
      'orgs/' || v_org_a_id::text || '/logo/b0000000-0000-4000-8000-000000000020.webp',
      v_user_id
    );
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Direct INSERT into storage.objects for org-media by authenticated must fail with 42501';
  END IF;

  v_rows := 0;
  BEGIN
    UPDATE storage.objects
    SET name = v_logo_path || '.tampered'
    WHERE bucket_id = 'org-media'
      AND name = v_logo_path;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Direct UPDATE on storage.objects for org-media by authenticated must fail (42501) or affect 0 rows, updated %', v_rows;
  END IF;

  v_rows := 0;
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'org-media'
      AND name = v_logo_path;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Direct DELETE on storage.objects for org-media by authenticated must fail (42501) or affect 0 rows, deleted %', v_rows;
  END IF;

  RESET ROLE;

  SELECT count(*)
    INTO v_rows
  FROM storage.objects
  WHERE bucket_id = 'org-media'
    AND name = v_logo_path;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Seeded org-media storage.objects row must remain unchanged after authenticated UPDATE/DELETE attempts, found %', v_rows;
  END IF;

  SET LOCAL ROLE anon;

  BEGIN
    INSERT INTO storage.objects (bucket_id, name)
    VALUES (
      'org-media',
      'orgs/' || v_org_a_id::text || '/logo/b0000000-0000-4000-8000-000000000021.webp'
    );
    v_blocked := false;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Direct INSERT into storage.objects for org-media by anon must fail with 42501';
  END IF;

  v_rows := 0;
  BEGIN
    UPDATE storage.objects
    SET name = v_logo_path || '.tampered'
    WHERE bucket_id = 'org-media'
      AND name = v_logo_path;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Direct UPDATE on storage.objects for org-media by anon must fail (42501) or affect 0 rows, updated %', v_rows;
  END IF;

  v_rows := 0;
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'org-media'
      AND name = v_logo_path;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_blocked := (v_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Direct DELETE on storage.objects for org-media by anon must fail (42501) or affect 0 rows, deleted %', v_rows;
  END IF;

  RESET ROLE;

  SELECT count(*)
    INTO v_rows
  FROM storage.objects
  WHERE bucket_id = 'org-media'
    AND name = v_logo_path;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Seeded org-media storage.objects row must remain unchanged after anon UPDATE/DELETE attempts, found %', v_rows;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    UPDATE public.organizations
    SET logo_url = 'https://evil.example/track.png'
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Arbitrary external logo_url must fail with check_violation (23514)';
  END IF;

  BEGIN
    UPDATE public.organizations
    SET cover_url = 'https://evil.example/track.png'
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Arbitrary external cover_url must fail with check_violation (23514)';
  END IF;

  BEGIN
    UPDATE public.organizations
    SET logo_url = v_logo_url
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Authenticated direct logo_url write must fail with check_violation (23514)';
  END IF;

  BEGIN
    UPDATE public.organizations
    SET cover_url = v_cover_url
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Authenticated direct cover_url write must fail with check_violation (23514)';
  END IF;

  BEGIN
    UPDATE public.organizations
    SET logo_url = 'https://myccs.supabase.co/storage/v1/object/public/org-media/orgs/' || v_org_b_id::text || '/logo/b0000000-0000-4000-8000-000000000032.webp'
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Cross-org org-media logo_url must fail with check_violation (23514)';
  END IF;

  BEGIN
    UPDATE public.organizations
    SET cover_url = 'https://myccs.supabase.co/storage/v1/object/public/org-media/orgs/' || v_org_b_id::text || '/cover/b0000000-0000-4000-8000-000000000033.webp'
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'Cross-org org-media cover_url must fail with check_violation (23514)';
  END IF;

  RESET ROLE;

  SET LOCAL ROLE service_role;

  UPDATE public.organizations
  SET logo_url = v_org_b_logo_url
  WHERE id = v_org_b_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Expected service_role UPDATE on Org B with its own existing org-media logo_url to succeed';
  END IF;

  BEGIN
    UPDATE public.organizations
    SET logo_url = v_org_b_logo_url
    WHERE id = v_org_a_id;
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'service_role cross-org org-media logo_url referencing existing Org B object must fail with check_violation (23514)';
  END IF;

  UPDATE public.organizations
  SET
    logo_url = v_logo_url,
    cover_url = v_cover_url
  WHERE id = v_org_a_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Expected service_role UPDATE with existing org-media WebP logo_url and cover_url to succeed';
  END IF;

  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  UPDATE public.organizations
  SET details = 'Updated details without modifying media URLs'
  WHERE id = v_org_a_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Expected authenticated admin details UPDATE with unchanged media URLs to succeed';
  END IF;

  UPDATE public.organizations
  SET logo_url = NULL
  WHERE id = v_org_a_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'Expected clearing logo_url to NULL to succeed';
  END IF;

  RESET ROLE;
END;
$$;

ROLLBACK;
