-- spec-05-gmetrix-csv-and-push (SCRUM-14): Certification directory, GMetrix CSV
-- key batches, encrypted certification_keys, in-app notifications, Expo push_tokens,
-- RLS + FORCE RLS, explicit GRANTs, SECURITY INVOKER update guards, and RPCs.

-- 1. Tables & indexes.

CREATE TABLE IF NOT EXISTS public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) >= 1 AND length(btrim(title)) <= 160),
  provider text NOT NULL CHECK (length(btrim(provider)) >= 1 AND length(btrim(provider)) <= 120),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_unique_active_title
  ON public.certifications (lower(btrim(provider)), lower(btrim(title)))
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.certification_key_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id uuid NOT NULL REFERENCES public.certifications(id) ON DELETE RESTRICT,
  uploaded_by_admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total_rows integer NOT NULL CHECK (total_rows >= 0),
  assigned_count integer NOT NULL CHECK (assigned_count >= 0),
  rejected_count integer NOT NULL CHECK (rejected_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_certification_key_batches_counts CHECK (
    assigned_count + rejected_count = total_rows
  )
);

CREATE INDEX IF NOT EXISTS idx_certification_key_batches_created_at
  ON public.certification_key_batches (created_at DESC);

CREATE TABLE IF NOT EXISTS public.certification_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.certification_key_batches(id) ON DELETE RESTRICT,
  certification_id uuid NOT NULL REFERENCES public.certifications(id) ON DELETE RESTRICT,
  student_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key_code_enc bytea NOT NULL CHECK (octet_length(key_code_enc) > 0),
  key_code_hash text NOT NULL UNIQUE CHECK (length(btrim(key_code_hash)) > 0),
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version >= 1),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_certification_keys_student_assigned
  ON public.certification_keys (student_profile_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_certification_keys_batch_id
  ON public.certification_keys (batch_id);

CREATE INDEX IF NOT EXISTS idx_certification_keys_certification_id
  ON public.certification_keys (certification_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('gmetrix_key', 'org_application', 'event')),
  title text NOT NULL CHECK (length(btrim(title)) >= 1),
  body text NOT NULL CHECK (length(btrim(body)) >= 1),
  deep_link text NOT NULL CHECK (deep_link ~ '^myccs://[a-z0-9/_-]+$'),
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_profile_created
  ON public.notifications (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
  ON public.notifications (profile_id)
  WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE CHECK (
    expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,128}\]$'
  ),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_profile_id
  ON public.push_tokens (profile_id);

-- 2. SECURITY INVOKER column-immutability & timestamp triggers.

CREATE OR REPLACE FUNCTION public.guard_certification_keys_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
       OR NEW.certification_id IS DISTINCT FROM OLD.certification_id
       OR NEW.student_profile_id IS DISTINCT FROM OLD.student_profile_id
       OR NEW.key_code_enc IS DISTINCT FROM OLD.key_code_enc
       OR NEW.key_code_hash IS DISTINCT FROM OLD.key_code_hash
       OR NEW.key_version IS DISTINCT FROM OLD.key_version
       OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at THEN
      RAISE EXCEPTION 'Cannot modify immutable certification_keys columns directly'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.viewed_at IS DISTINCT FROM OLD.viewed_at
       AND (OLD.viewed_at IS NOT NULL OR NEW.viewed_at IS NULL) THEN
      RAISE EXCEPTION 'viewed_at may only be set once from NULL to a timestamp'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_certification_keys_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_certification_keys_guard_mutation ON public.certification_keys;
CREATE TRIGGER trg_certification_keys_guard_mutation
BEFORE UPDATE ON public.certification_keys
FOR EACH ROW
EXECUTE FUNCTION public.guard_certification_keys_mutation();

CREATE OR REPLACE FUNCTION public.guard_notifications_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.deep_link IS DISTINCT FROM OLD.deep_link
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Cannot modify immutable notifications columns directly'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.read_at IS DISTINCT FROM OLD.read_at
       AND (OLD.read_at IS NOT NULL OR NEW.read_at IS NULL) THEN
      RAISE EXCEPTION 'read_at may only be set once from NULL to a timestamp'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_notifications_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notifications_guard_mutation ON public.notifications;
CREATE TRIGGER trg_notifications_guard_mutation
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.guard_notifications_mutation();

CREATE OR REPLACE FUNCTION public.guard_push_tokens_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' AND current_user = 'authenticated' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
      RAISE EXCEPTION 'Cannot modify immutable push_tokens columns directly'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_push_tokens_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_push_tokens_guard_mutation ON public.push_tokens;
CREATE TRIGGER trg_push_tokens_guard_mutation
BEFORE INSERT OR UPDATE ON public.push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.guard_push_tokens_mutation();

-- 3. Mandatory Row Level Security, FORCE RLS & explicit GRANT statements.

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.certification_key_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_key_batches FORCE ROW LEVEL SECURITY;

ALTER TABLE public.certification_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_keys FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.certifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.certification_key_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.certification_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.push_tokens FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.certifications TO authenticated;
GRANT SELECT ON TABLE public.certification_key_batches TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.certification_keys TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO authenticated;

GRANT SELECT ON TABLE public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.certifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.certification_key_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.certification_keys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_tokens TO service_role;

-- 4. RLS policies.

-- 4a. certifications
DROP POLICY IF EXISTS certifications_select_authenticated ON public.certifications;
CREATE POLICY certifications_select_authenticated
  ON public.certifications
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR (public.is_active_profile() AND is_active = true));

DROP POLICY IF EXISTS certifications_insert_admin ON public.certifications;
CREATE POLICY certifications_insert_admin
  ON public.certifications
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS certifications_update_admin ON public.certifications;
CREATE POLICY certifications_update_admin
  ON public.certifications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS certifications_delete_admin ON public.certifications;
CREATE POLICY certifications_delete_admin
  ON public.certifications
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 4b. certification_key_batches
DROP POLICY IF EXISTS certification_key_batches_select_admin ON public.certification_key_batches;
CREATE POLICY certification_key_batches_select_admin
  ON public.certification_key_batches
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 4c. certification_keys
DROP POLICY IF EXISTS certification_keys_select_own ON public.certification_keys;
CREATE POLICY certification_keys_select_own
  ON public.certification_keys
  FOR SELECT
  TO authenticated
  USING (public.is_active_profile() AND student_profile_id = (select auth.uid()));

DROP POLICY IF EXISTS certification_keys_select_admin ON public.certification_keys;
CREATE POLICY certification_keys_select_admin
  ON public.certification_keys
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS certification_keys_update_own ON public.certification_keys;
CREATE POLICY certification_keys_update_own
  ON public.certification_keys
  FOR UPDATE
  TO authenticated
  USING (public.is_active_profile() AND student_profile_id = (select auth.uid()))
  WITH CHECK (public.is_active_profile() AND student_profile_id = (select auth.uid()));

-- 4d. notifications
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (public.is_active_profile() AND profile_id = (select auth.uid()));

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (public.is_active_profile() AND profile_id = (select auth.uid()))
  WITH CHECK (public.is_active_profile() AND profile_id = (select auth.uid()));

-- 4e. push_tokens
DROP POLICY IF EXISTS push_tokens_select_own ON public.push_tokens;
CREATE POLICY push_tokens_select_own
  ON public.push_tokens
  FOR SELECT
  TO authenticated
  USING (public.is_active_profile() AND profile_id = (select auth.uid()));

DROP POLICY IF EXISTS push_tokens_insert_own ON public.push_tokens;
CREATE POLICY push_tokens_insert_own
  ON public.push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_profile() AND profile_id = (select auth.uid()));

DROP POLICY IF EXISTS push_tokens_update_own ON public.push_tokens;
CREATE POLICY push_tokens_update_own
  ON public.push_tokens
  FOR UPDATE
  TO authenticated
  USING (public.is_active_profile() AND profile_id = (select auth.uid()))
  WITH CHECK (public.is_active_profile() AND profile_id = (select auth.uid()));

DROP POLICY IF EXISTS push_tokens_delete_own ON public.push_tokens;
CREATE POLICY push_tokens_delete_own
  ON public.push_tokens
  FOR DELETE
  TO authenticated
  USING (public.is_active_profile() AND profile_id = (select auth.uid()));

-- 5. RPC functions.

DROP FUNCTION IF EXISTS public.get_gmetrix_runtime_secrets();

CREATE OR REPLACE FUNCTION public.get_gmetrix_runtime_secrets(
  p_include_blind_pepper boolean DEFAULT true,
  p_include_cert_key boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blind_pepper text := NULL;
  v_cert_key text := NULL;
BEGIN
  IF p_include_blind_pepper IS TRUE THEN
    v_blind_pepper := public.get_identity_secret('myccs_email_blind_pepper');
  END IF;

  IF p_include_cert_key IS TRUE THEN
    v_cert_key := public.get_identity_secret('myccs_cert_key_encryption_key');
  END IF;

  RETURN jsonb_build_object(
    'emailBlindPepper', v_blind_pepper,
    'certKeyEncryptionKey', v_cert_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_gmetrix_runtime_secrets(boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_gmetrix_runtime_secrets(boolean, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.lookup_active_profiles_by_blind_indexes(
  p_blind_indexes text[]
)
RETURNS TABLE (id uuid, email_blind_index text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email_blind_index
  FROM public.profiles p
  WHERE p.email_blind_index = ANY(COALESCE(p_blind_indexes, ARRAY[]::text[]))
    AND p.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.lookup_active_profiles_by_blind_indexes(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_active_profiles_by_blind_indexes(text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.load_push_tokens_for_profiles(
  p_profile_ids uuid[]
)
RETURNS TABLE (expo_push_token text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT pt.expo_push_token
  FROM public.push_tokens pt
  WHERE pt.profile_id = ANY(COALESCE(p_profile_ids, ARRAY[]::uuid[]))
  ORDER BY pt.expo_push_token ASC;
$$;

REVOKE ALL ON FUNCTION public.load_push_tokens_for_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.load_push_tokens_for_profiles(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_push_tokens_by_values(
  p_tokens text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.push_tokens
  WHERE expo_push_token = ANY(COALESCE(p_tokens, ARRAY[]::text[]));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_push_tokens_by_values(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_push_tokens_by_values(text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.commit_gmetrix_key_batch(
  p_certification_id uuid,
  p_uploaded_by_admin_id uuid,
  p_total_rows integer,
  p_entries jsonb,
  p_notification_title text,
  p_notification_body text,
  p_deep_link text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id uuid;
  v_assigned integer := 0;
  v_notifications_inserted integer := 0;
  v_committed_hashes jsonb := '[]'::jsonb;
  v_missing_profile_hashes jsonb := '[]'::jsonb;
  v_notified_profile_ids jsonb := '[]'::jsonb;
  v_title text := btrim(COALESCE(p_notification_title, ''));
  v_body text := btrim(COALESCE(p_notification_body, ''));
  v_deep_link text := btrim(COALESCE(p_deep_link, ''));
BEGIN
  IF p_total_rows IS NULL OR p_total_rows < 0 THEN
    RAISE EXCEPTION 'total_rows must be a non-negative integer'
      USING ERRCODE = '22023';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'entries must be a JSON array'
      USING ERRCODE = '22023';
  END IF;

  IF length(v_title) = 0 OR length(v_body) = 0 OR v_deep_link !~ '^myccs://[a-z0-9/_-]+$' THEN
    RAISE EXCEPTION 'Valid notification title, body, and MyCCS deep link are required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.certifications
    WHERE id = p_certification_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Certification not found or inactive'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_uploaded_by_admin_id
      AND deleted_at IS NULL
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Uploader must be an active Department Admin'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.certification_key_batches (
    certification_id,
    uploaded_by_admin_id,
    total_rows,
    assigned_count,
    rejected_count
  )
  VALUES (
    p_certification_id,
    p_uploaded_by_admin_id,
    p_total_rows,
    0,
    p_total_rows
  )
  RETURNING id INTO v_batch_id;

  WITH classified AS (
    SELECT
      e.student_profile_id,
      btrim(COALESCE(e.key_code_enc_hex, '')) AS key_code_enc_hex,
      btrim(COALESCE(e.key_code_hash, '')) AS key_code_hash,
      COALESCE(e.key_version, 1) AS key_version,
      (p.id IS NOT NULL) AS profile_active
    FROM jsonb_to_recordset(p_entries) AS e(
      student_profile_id uuid,
      key_code_enc_hex text,
      key_code_hash text,
      key_version integer
    )
    LEFT JOIN public.profiles p
      ON p.id = e.student_profile_id
     AND p.deleted_at IS NULL
  ),
  inserted_keys AS (
    INSERT INTO public.certification_keys (
      batch_id,
      certification_id,
      student_profile_id,
      key_code_enc,
      key_code_hash,
      key_version
    )
    SELECT
      v_batch_id,
      p_certification_id,
      c.student_profile_id,
      decode(
        CASE
          WHEN left(c.key_code_enc_hex, 2) IN ('\x', '\X')
            THEN substr(c.key_code_enc_hex, 3)
          ELSE c.key_code_enc_hex
        END,
        'hex'
      ),
      c.key_code_hash,
      c.key_version
    FROM classified c
    WHERE c.profile_active
    ON CONFLICT (key_code_hash) DO NOTHING
    RETURNING id, student_profile_id, key_code_hash
  ),
  inserted_notifications AS (
    INSERT INTO public.notifications (
      profile_id,
      type,
      title,
      body,
      deep_link
    )
    SELECT
      ik.student_profile_id,
      'gmetrix_key',
      v_title,
      v_body,
      v_deep_link
    FROM inserted_keys ik
    RETURNING id
  )
  SELECT
    COUNT(*)::integer,
    COALESCE(jsonb_agg(ik.key_code_hash), '[]'::jsonb),
    COALESCE(jsonb_agg(DISTINCT ik.student_profile_id), '[]'::jsonb),
    COALESCE(
      (SELECT jsonb_agg(c.key_code_hash) FROM classified c WHERE NOT c.profile_active),
      '[]'::jsonb
    ),
    (SELECT COUNT(*)::integer FROM inserted_notifications)
  INTO
    v_assigned,
    v_committed_hashes,
    v_notified_profile_ids,
    v_missing_profile_hashes,
    v_notifications_inserted
  FROM inserted_keys ik;

  IF v_assigned > p_total_rows THEN
    RAISE EXCEPTION 'Assigned count cannot exceed total_rows'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.certification_key_batches
  SET assigned_count = v_assigned,
      rejected_count = p_total_rows - v_assigned
  WHERE id = v_batch_id;

  RETURN jsonb_build_object(
    'batchId', v_batch_id,
    'assignedCount', v_assigned,
    'rejectedCount', p_total_rows - v_assigned,
    'committedHashes', v_committed_hashes,
    'missingProfileHashes', v_missing_profile_hashes,
    'notifiedProfileIds', v_notified_profile_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_gmetrix_key_batch(
  uuid,
  uuid,
  integer,
  jsonb,
  text,
  text,
  text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_gmetrix_key_batch(
  uuid,
  uuid,
  integer,
  jsonb,
  text,
  text,
  text
) TO service_role;

CREATE OR REPLACE FUNCTION public.register_push_token(
  p_expo_push_token text,
  p_platform text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text := btrim(COALESCE(p_expo_push_token, ''));
  v_platform text := lower(btrim(COALESCE(p_platform, '')));
  v_id uuid;
  v_updated_at timestamptz;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_profile() THEN
    RAISE EXCEPTION 'Active authenticated profile required to register push token'
      USING ERRCODE = '42501';
  END IF;

  IF v_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{8,128}\]$' THEN
    RAISE EXCEPTION 'Invalid Expo Push Token format'
      USING ERRCODE = '22023';
  END IF;

  IF v_platform NOT IN ('ios', 'android', 'web') THEN
    RAISE EXCEPTION 'Push platform must be ios, android, or web'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_tokens (profile_id, expo_push_token, platform, updated_at)
  VALUES (v_uid, v_token, v_platform, now())
  ON CONFLICT (expo_push_token) DO UPDATE
  SET profile_id = EXCLUDED.profile_id,
      platform = EXCLUDED.platform,
      updated_at = now()
  RETURNING id, updated_at INTO v_id, v_updated_at;

  RETURN jsonb_build_object(
    'id', v_id,
    'expoPushToken', v_token,
    'platform', v_platform,
    'updatedAt', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pii_encryption_key_for_version(p_key_version integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version integer := COALESCE(p_key_version, 1);
  v_versioned_secret text;
BEGIN
  IF v_version < 1 THEN
    RAISE EXCEPTION 'Invalid PII key_version: %', v_version
      USING ERRCODE = '22023';
  END IF;

  IF to_regclass('vault.decrypted_secrets') IS NOT NULL THEN
    SELECT decrypted_secret
      INTO v_versioned_secret
    FROM vault.decrypted_secrets
    WHERE name = 'myccs_pii_encryption_key_v' || v_version::text
    LIMIT 1;

    IF v_versioned_secret IS NOT NULL AND length(v_versioned_secret) >= 16 THEN
      RETURN v_versioned_secret;
    END IF;
  END IF;

  RETURN public.get_identity_secret('myccs_pii_encryption_key');
END;
$$;

REVOKE ALL ON FUNCTION public.get_pii_encryption_key_for_version(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_admin_profiles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only Department Admins may list admin profiles'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'email', extensions.pgp_sym_decrypt(p.email_enc, k.pii_key),
        'fullName', extensions.pgp_sym_decrypt(p.full_name_enc, k.pii_key),
        'role', p.role,
        'createdAt', p.created_at
      )
      ORDER BY p.created_at ASC, p.id ASC
    ),
    '[]'::jsonb
  )
    INTO v_result
  FROM public.profiles p
  CROSS JOIN LATERAL (
    SELECT public.get_pii_encryption_key_for_version(p.key_version) AS pii_key
  ) k
  WHERE p.role = 'admin'
    AND p.deleted_at IS NULL;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_faculty_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_blind_pepper text;
  v_pii_key text;
  v_blind_index text;
  v_row public.profiles%ROWTYPE;
  v_already_admin boolean;
  v_decrypted_email text;
  v_decrypted_full_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only Department Admins may promote faculty accounts'
      USING ERRCODE = '42501';
  END IF;

  IF v_email !~ '^[a-z0-9._%+-]+@lpunetwork\.edu\.ph$' THEN
    RAISE EXCEPTION 'Faculty email must be a valid @lpunetwork.edu.ph institutional address'
      USING ERRCODE = '22023';
  END IF;

  v_blind_pepper := public.get_identity_secret('myccs_email_blind_pepper');

  v_blind_index := encode(
    extensions.hmac(convert_to(v_email, 'UTF8'), convert_to(v_blind_pepper, 'UTF8'), 'sha256'),
    'hex'
  );

  SELECT *
    INTO v_row
  FROM public.profiles
  WHERE email_blind_index = v_blind_index
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target institutional profile not found'
      USING ERRCODE = 'P0002';
  END IF;

  v_pii_key := public.get_pii_encryption_key_for_version(v_row.key_version);
  v_already_admin := (v_row.role = 'admin');

  IF NOT v_already_admin THEN
    UPDATE public.profiles
    SET role = 'admin',
        updated_at = now()
    WHERE id = v_row.id
      AND deleted_at IS NULL;
  END IF;

  v_decrypted_email := extensions.pgp_sym_decrypt(v_row.email_enc, v_pii_key);
  v_decrypted_full_name := extensions.pgp_sym_decrypt(v_row.full_name_enc, v_pii_key);

  RETURN jsonb_build_object(
    'id', v_row.id,
    'email', v_decrypted_email,
    'fullName', v_decrypted_full_name,
    'role', 'admin',
    'alreadyAdmin', v_already_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.promote_faculty_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_faculty_by_email(text) TO authenticated;
