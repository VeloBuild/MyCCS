-- spec-01-auth-identity (SCRUM-10): Idempotent initial Department Admin bootstrap seed.
-- Ensures local dev Vault secrets exist and seeds auth.users + auth.identities + public.profiles.

DO $$
DECLARE
  v_admin_id uuid := '00000000-0000-4000-8000-000000000001';
  v_admin_email text := 'ccs.admin@lpunetwork.edu.ph';
  v_admin_name text := 'CCS Department Admin';
  v_admin_staff_id text := 'CCS-ADMIN-0001';
  v_secret_name text;
  v_pii_key text;
  v_blind_pepper text;
  v_qr_secret text;
  v_blind_index text;
  v_qr_token text;
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

  SELECT id
    INTO v_admin_id
  FROM auth.users
  WHERE lower(email) = v_admin_email
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    v_admin_id := '00000000-0000-4000-8000-000000000001';
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
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_admin_email,
      extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"seeded_admin":true}'::jsonb,
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
    v_admin_id,
    v_admin_id,
    jsonb_build_object('sub', v_admin_id::text, 'email', v_admin_email, 'email_verified', true),
    'email',
    v_admin_id::text,
    now(),
    now(),
    now()
  )
  ON CONFLICT DO NOTHING;

  v_pii_key := public.get_identity_secret('myccs_pii_encryption_key');
  v_blind_pepper := public.get_identity_secret('myccs_email_blind_pepper');
  v_qr_secret := public.get_identity_secret('myccs_qr_hmac_secret');

  v_blind_index := encode(
    extensions.hmac(convert_to(v_admin_email, 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'),
    'hex'
  );
  v_qr_token := 'v1.' || v_admin_id::text || '.' || substr(
    encode(
      extensions.hmac(convert_to('v1:' || v_admin_id::text, 'UTF8'), convert_to(v_qr_secret, 'UTF8'), 'sha256'),
      'hex'
    ),
    1,
    24
  );

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE email_blind_index = v_blind_index
      AND id <> v_admin_id
  ) THEN
    UPDATE public.profiles
    SET role = 'admin',
        deleted_at = NULL,
        updated_at = now()
    WHERE email_blind_index = v_blind_index;
  ELSE
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
      v_admin_id,
      extensions.pgp_sym_encrypt(v_admin_staff_id, v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt(v_admin_name, v_pii_key, 'cipher-algo=aes256'),
      extensions.pgp_sym_encrypt(v_admin_email, v_pii_key, 'cipher-algo=aes256'),
      v_blind_index,
      1,
      v_qr_token,
      'admin'
    )
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin',
        deleted_at = NULL,
        updated_at = now();
  END IF;
END;
$$;
