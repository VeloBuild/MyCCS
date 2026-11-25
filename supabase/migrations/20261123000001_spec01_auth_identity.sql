-- spec-01-auth-identity (SCRUM-10): Server-side @lpunetwork.edu.ph auth hook,
-- encrypted profiles table with blind index, RLS, explicit GRANTs, fail-closed Vault secrets, and provisioning RPCs.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Server-side before-user-created Auth Hook enforcing @lpunetwork.edu.ph domain.
CREATE OR REPLACE FUNCTION public.hook_restrict_signup_domain(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  v_email := lower(btrim(COALESCE(event -> 'user' ->> 'email', '')));

  IF v_email !~ '^[a-z0-9._%+-]+@lpunetwork\.edu\.ph$' THEN
    RETURN jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'Signup restricted to verified @lpunetwork.edu.ph institutional accounts.'
      )
    );
  END IF;

  RETURN '{}'::jsonb;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE ALL ON FUNCTION public.hook_restrict_signup_domain(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hook_restrict_signup_domain(jsonb) TO supabase_auth_admin;

-- 2. Fail-closed Supabase Vault secret loader (no predictable fallbacks or USERSET GUCs).
CREATE OR REPLACE FUNCTION public.get_identity_secret(p_secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'Supabase Vault is required to load secret: %', p_secret_name
      USING ERRCODE = '42501';
  END IF;

  SELECT decrypted_secret
    INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_secret_name
  LIMIT 1;

  IF v_secret IS NULL OR length(v_secret) < 16 THEN
    RAISE EXCEPTION 'Missing or invalid required Vault secret: %', p_secret_name
      USING ERRCODE = '42501';
  END IF;

  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_identity_secret(text) FROM PUBLIC, anon, authenticated;

-- 3. Encrypted student/officer/admin profiles table.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id_enc bytea NOT NULL,
  full_name_enc bytea NOT NULL,
  email_enc bytea NOT NULL,
  email_blind_index text NOT NULL UNIQUE,
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version >= 1),
  qr_token text NOT NULL UNIQUE CHECK (
    qr_token ~ '^v1\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{24}$'
  ),
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'officer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 4. Anti-recursion RLS helper functions.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_user_role() = 'admin', false);
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_profiles_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.email_enc IS DISTINCT FROM OLD.email_enc
      OR NEW.email_blind_index IS DISTINCT FROM OLD.email_blind_index
      OR NEW.qr_token IS DISTINCT FROM OLD.qr_token
      OR NEW.key_version IS DISTINCT FROM OLD.key_version
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Cannot modify immutable identity columns directly'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only Department Admins may change profile roles'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profiles_immutable_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_guard_immutable ON public.profiles;
CREATE TRIGGER trg_profiles_guard_immutable
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profiles_immutable_columns();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profiles_updated_at();

-- 5. Mandatory Row Level Security & explicit GRANT statements.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id AND deleted_at IS NULL);

DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin() AND deleted_at IS NULL);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = id AND role = public.current_user_role());

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND deleted_at IS NULL)
  WITH CHECK (public.is_admin());

-- 6. Server-side profile provisioning, retrieval, and admin faculty-promotion RPCs.
-- shortcut: spec-01 provisions encrypted profiles via Postgres SECURITY DEFINER RPC + pgcrypto/Vault; upgrade to a shared EdgeCrypto Deno endpoint importing shared/identity-crypto.ts in spec-05 if cross-runtime AEAD key sharing is needed
CREATE OR REPLACE FUNCTION public.provision_profile(
  p_full_name text,
  p_student_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_deleted_at timestamptz;
  v_full_name text := btrim(COALESCE(p_full_name, ''));
  v_student_id text := btrim(COALESCE(p_student_id, ''));
  v_pii_key text;
  v_blind_pepper text;
  v_qr_secret text;
  v_blind_index text;
  v_qr_token text;
  v_role text;
  v_key_version integer := 1;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT lower(btrim(email)), email_confirmed_at
    INTO v_email, v_confirmed_at
  FROM auth.users
  WHERE id = v_uid;

  IF v_email IS NULL OR v_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Verified institutional email is required before provisioning profile' USING ERRCODE = '42501';
  END IF;

  IF v_email !~ '^[a-z0-9._%+-]+@lpunetwork\.edu\.ph$' THEN
    RAISE EXCEPTION 'Institutional @lpunetwork.edu.ph email required' USING ERRCODE = '42501';
  END IF;

  IF length(v_full_name) < 2 OR length(v_student_id) < 4 THEN
    RAISE EXCEPTION 'Valid full name and private student ID are required' USING ERRCODE = '22023';
  END IF;

  SELECT deleted_at
    INTO v_deleted_at
  FROM public.profiles
  WHERE id = v_uid;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted profile cannot be provisioned' USING ERRCODE = '42501';
  END IF;

  v_pii_key := public.get_identity_secret('myccs_pii_encryption_key');
  v_blind_pepper := public.get_identity_secret('myccs_email_blind_pepper');
  v_qr_secret := public.get_identity_secret('myccs_qr_hmac_secret');

  v_blind_index := encode(
    extensions.hmac(convert_to(v_email, 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'),
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
    extensions.pgp_sym_encrypt(v_student_id, v_pii_key, 'cipher-algo=aes256'),
    extensions.pgp_sym_encrypt(v_full_name, v_pii_key, 'cipher-algo=aes256'),
    extensions.pgp_sym_encrypt(v_email, v_pii_key, 'cipher-algo=aes256'),
    v_blind_index,
    v_key_version,
    v_qr_token,
    'student'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name_enc = EXCLUDED.full_name_enc,
      student_id_enc = EXCLUDED.student_id_enc,
      email_enc = EXCLUDED.email_enc,
      email_blind_index = EXCLUDED.email_blind_index,
      key_version = EXCLUDED.key_version,
      updated_at = now()
  WHERE public.profiles.deleted_at IS NULL
  RETURNING role, qr_token, key_version INTO v_role, v_qr_token, v_key_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted profile cannot be provisioned' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'id', v_uid,
    'email', v_email,
    'fullName', v_full_name,
    'role', v_role,
    'qrToken', v_qr_token,
    'keyVersion', v_key_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provision_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provision_profile(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pii_key text;
  v_row public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_row
  FROM public.profiles
  WHERE id = v_uid
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_pii_key := public.get_identity_secret('myccs_pii_encryption_key');

  RETURN jsonb_build_object(
    'id', v_row.id,
    'email', extensions.pgp_sym_decrypt(v_row.email_enc, v_pii_key),
    'fullName', extensions.pgp_sym_decrypt(v_row.full_name_enc, v_pii_key),
    'role', v_row.role,
    'qrToken', v_row.qr_token,
    'keyVersion', v_row.key_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_faculty_to_admin(p_target_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id uuid;
  v_updated_role text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only Department Admins may promote faculty accounts' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET role = 'admin',
      updated_at = now()
  WHERE id = p_target_profile_id
    AND deleted_at IS NULL
  RETURNING id, role INTO v_updated_id, v_updated_role;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Target profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('id', v_updated_id, 'role', v_updated_role);
END;
$$;

REVOKE ALL ON FUNCTION public.promote_faculty_to_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_faculty_to_admin(uuid) TO authenticated;
