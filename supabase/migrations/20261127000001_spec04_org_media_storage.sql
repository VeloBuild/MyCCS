INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'org-media',
  'org-media',
  true,
  5242880,
  ARRAY['image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS org_media_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS org_media_update_authenticated ON storage.objects;
DROP POLICY IF EXISTS org_media_delete_authenticated ON storage.objects;

DROP POLICY IF EXISTS org_media_select_authenticated ON storage.objects;
CREATE POLICY org_media_select_authenticated
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'org-media' AND public.is_active_profile());

CREATE OR REPLACE FUNCTION public.guard_organizations_media_urls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF NEW.logo_url IS NOT NULL
       AND (
         TG_OP = 'INSERT'
         OR NEW.logo_url IS DISTINCT FROM OLD.logo_url
         OR NEW.id IS DISTINCT FROM OLD.id
       ) THEN
      IF NEW.id IS NULL OR NOT (
        NEW.logo_url ~* (
          '^https?://[^/]+/storage/v1/object/public/org-media/orgs/'
          || NEW.id::text
          || '/logo/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
        )
      ) THEN
        RAISE EXCEPTION 'Organization logo_url must reference a verified org-media WebP asset for this organization'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW.cover_url IS NOT NULL
       AND (
         TG_OP = 'INSERT'
         OR NEW.cover_url IS DISTINCT FROM OLD.cover_url
         OR NEW.id IS DISTINCT FROM OLD.id
       ) THEN
      IF NEW.id IS NULL OR NOT (
        NEW.cover_url ~* (
          '^https?://[^/]+/storage/v1/object/public/org-media/orgs/'
          || NEW.id::text
          || '/cover/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
        )
      ) THEN
        RAISE EXCEPTION 'Organization cover_url must reference a verified org-media WebP asset for this organization'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_organizations_media_urls() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_organizations_guard_media_urls ON public.organizations;
CREATE TRIGGER trg_organizations_guard_media_urls
BEFORE INSERT OR UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.guard_organizations_media_urls();
