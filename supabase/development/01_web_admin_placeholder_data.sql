-- LOCAL DEVELOPMENT ONLY — DO NOT RUN IN PRODUCTION.
-- Placeholder users (admin, faculty, officer, student, unprovisioned) and core CCS
-- records for manual testing of web-admin/ login, role guards, and governance views.
-- Loaded automatically by `npx supabase db reset` via [db.seed].sql_paths in supabase/config.toml.
-- Never applied by production `npx supabase db push`.

DO $$
DECLARE
  v_dev_password text := 'MyCCSDev!2026';
  v_secret_name text;
  v_pii_key text;
  v_blind_pepper text;
  v_qr_secret text;

  v_rec record;
  v_uid uuid;
  v_blind_index text;
  v_qr_token text;

  v_dept_id uuid := 'd1000000-0000-4000-8000-000000000001';
  v_org_main_id uuid := 'd2000000-0000-4000-8000-000000000001';
  v_org_sub_dev_id uuid := 'd2000000-0000-4000-8000-000000000002';
  v_org_sub_sec_id uuid := 'd2000000-0000-4000-8000-000000000003';
  v_officer_id uuid := 'd0000000-0000-4000-8000-000000000003';
  v_student_id uuid := 'd0000000-0000-4000-8000-000000000004';
  v_ann_dept_id uuid := 'd3000000-0000-4000-8000-000000000001';
  v_ann_org_id uuid := 'd3000000-0000-4000-8000-000000000002';
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

  v_pii_key := public.get_identity_secret('myccs_pii_encryption_key');
  v_blind_pepper := public.get_identity_secret('myccs_email_blind_pepper');
  v_qr_secret := public.get_identity_secret('myccs_qr_hmac_secret');

  FOR v_rec IN
    SELECT *
    FROM (
      VALUES
        (
          'd0000000-0000-4000-8000-000000000001'::uuid,
          'dev.admin@lpunetwork.edu.ph',
          'Dr. Elena Reyes (Dev Admin)',
          'CCS-DEV-ADMIN-01',
          'admin',
          true
        ),
        (
          'd0000000-0000-4000-8000-000000000002'::uuid,
          'dev.faculty@lpunetwork.edu.ph',
          'Prof. Marco Villanueva (Dev Faculty)',
          'CCS-DEV-FAC-01',
          'admin',
          true
        ),
        (
          'd0000000-0000-4000-8000-000000000003'::uuid,
          'dev.officer@lpunetwork.edu.ph',
          'Maria Santos (Dev Officer)',
          '2026-DEV-0003',
          'officer',
          true
        ),
        (
          'd0000000-0000-4000-8000-000000000004'::uuid,
          'dev.student@lpunetwork.edu.ph',
          'Juan Dela Cruz (Dev Student)',
          '2026-DEV-0004',
          'student',
          true
        ),
        (
          'd0000000-0000-4000-8000-000000000005'::uuid,
          'dev.unprovisioned@lpunetwork.edu.ph',
          'Unprovisioned Account (Dev)',
          '2026-DEV-0005',
          'student',
          false
        )
    ) AS t(user_id, email, full_name, student_id, app_role, should_provision)
  LOOP
    SELECT id
      INTO v_uid
    FROM auth.users
    WHERE lower(email) = v_rec.email
    LIMIT 1;

    IF v_uid IS NULL THEN
      v_uid := v_rec.user_id;
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      VALUES (
        v_uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_rec.email,
        extensions.crypt(v_dev_password, extensions.gen_salt('bf')),
        now(),
        '',
        '',
        '',
        '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', v_rec.full_name, 'dev_placeholder', true),
        now(),
        now()
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      v_uid,
      v_uid,
      jsonb_build_object(
        'sub', v_uid::text,
        'email', v_rec.email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      v_uid::text,
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;

    IF v_rec.email = 'dev.officer@lpunetwork.edu.ph' THEN
      v_officer_id := v_uid;
    ELSIF v_rec.email = 'dev.student@lpunetwork.edu.ph' THEN
      v_student_id := v_uid;
    END IF;

    IF v_rec.should_provision THEN
      v_blind_index := encode(
        extensions.hmac(convert_to(v_rec.email, 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'),
        'hex'
      );
      v_qr_token := 'v1.' || v_uid::text || '.' || substr(
        encode(
          extensions.hmac(convert_to('v1:' || v_uid::text, 'UTF8'), convert_to(v_qr_secret, 'UTF8'), 'sha256'),
          'hex'
        ),
        1,
        24
      );

      INSERT INTO public.profiles (
        id,
        student_id_enc,
        full_name_enc,
        email_enc,
        email_blind_index,
        key_version,
        qr_token,
        role
      )
      VALUES (
        v_uid,
        extensions.pgp_sym_encrypt(v_rec.student_id, v_pii_key, 'cipher-algo=aes256'),
        extensions.pgp_sym_encrypt(v_rec.full_name, v_pii_key, 'cipher-algo=aes256'),
        extensions.pgp_sym_encrypt(v_rec.email, v_pii_key, 'cipher-algo=aes256'),
        v_blind_index,
        1,
        v_qr_token,
        v_rec.app_role
      )
      ON CONFLICT (id) DO UPDATE
      SET role = EXCLUDED.role,
          deleted_at = NULL,
          updated_at = now();
    END IF;
  END LOOP;

  INSERT INTO public.department_info (id, title, about_markdown, leadership_json, contact_json)
  VALUES (
    v_dept_id,
    'College of Computing Studies (CCS)',
    E'## About CCS\nPlaceholder development profile for testing MyCCS Web Admin and mobile department screens.',
    '[
      {"name":"Dr. Elena Reyes","title":"Department Dean","email":"dev.admin@lpunetwork.edu.ph"},
      {"name":"Prof. Marco Villanueva","title":"Certification Coordinator","email":"dev.faculty@lpunetwork.edu.ph"}
    ]'::jsonb,
    '{"office":"CCS Building, Room 204","email":"ccs@lpunetwork.edu.ph"}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (id, parent_org_id, name, details)
  VALUES (
    v_org_main_id,
    NULL,
    'CCS Student Council (Dev)',
    'Main student governance body for the College of Computing Studies.'
  )
  ON CONFLICT DO NOTHING;

  SELECT id
  INTO v_org_main_id
  FROM public.organizations
  WHERE name = 'CCS Student Council (Dev)'
    AND parent_org_id IS NULL
  LIMIT 1;

  INSERT INTO public.organizations (id, parent_org_id, name, details)
  VALUES
    (
      v_org_sub_dev_id,
      v_org_main_id,
      'LPU Web & Mobile Developers Guild (Dev)',
      'Sub-organization focused on full-stack web, Expo mobile, and open-source workshops.'
    ),
    (
      v_org_sub_sec_id,
      v_org_main_id,
      'LPU Cybersecurity Society (Dev)',
      'Sub-organization focused on CTF competitions, AppSec, and cloud hardening.'
    )
  ON CONFLICT DO NOTHING;

  SELECT id
  INTO v_org_sub_dev_id
  FROM public.organizations
  WHERE name = 'LPU Web & Mobile Developers Guild (Dev)'
    AND parent_org_id = v_org_main_id
  LIMIT 1;

  SELECT id
  INTO v_org_sub_sec_id
  FROM public.organizations
  WHERE name = 'LPU Cybersecurity Society (Dev)'
    AND parent_org_id = v_org_main_id
  LIMIT 1;

  INSERT INTO public.org_memberships (profile_id, organization_id, role, status)
  VALUES
    (v_officer_id, v_org_sub_dev_id, 'officer', 'approved'),
    (v_student_id, v_org_sub_dev_id, 'member', 'approved'),
    (v_student_id, v_org_sub_sec_id, 'member', 'pending')
  ON CONFLICT (profile_id, organization_id) DO NOTHING;

  INSERT INTO public.announcements (id, organization_id, title, content, global_visibility, published_at, expires_at)
  VALUES
    (
      v_ann_dept_id,
      NULL,
      'CCS GMetrix Certification Orientation (Dev)',
      'Placeholder department-wide announcement visible to all active CCS accounts.',
      true,
      now() - interval '1 hour',
      now() + interval '30 days'
    ),
    (
      v_ann_org_id,
      v_org_sub_dev_id,
      'Developers Guild Kickoff Workshop (Dev)',
      'Placeholder organization announcement visible to approved Developers Guild members and officers.',
      false,
      now() - interval '30 minutes',
      now() + interval '14 days'
    )
  ON CONFLICT (id) DO NOTHING;
END;
$$;
