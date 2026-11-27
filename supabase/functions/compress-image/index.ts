import { createClient } from '@supabase/supabase-js';
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickGeometry,
  ResourceLimits,
} from '@imagemagick/magick-wasm';
import { getAllowedOriginsFromEnv, withCorsJson } from '../_shared/cors.ts';
import {
  buildPublicStorageObjectUrl,
  handleCompressImageRequest,
  loadWasmBytes,
  resolveRuntimeEnv,
  type AllowedInputImageMime,
  type CompressImageAuthContext,
  type CompressImageDeps,
  type CompressImageRuntimeEnv,
  type MediaKind,
} from './core.ts';

const SOURCE_MIME_TO_MAGICK_FORMAT: Record<AllowedInputImageMime, MagickFormat> = {
  'image/jpeg': MagickFormat.Jpeg,
  'image/png': MagickFormat.Png,
  'image/webp': MagickFormat.WebP,
};

let magickInitPromise: Promise<void> | null = null;

function ensureImageMagickInitialized(): Promise<void> {
  if (!magickInitPromise) {
    magickInitPromise = (async () => {
      const wasmUrl = new URL(
        import.meta.resolve('@imagemagick/magick-wasm/magick.wasm')
      );
      const wasmBytes = await loadWasmBytes(wasmUrl, {
        readFile: (url) => Deno.readFile(url),
        fetchFn: fetch,
      });
      await initializeImageMagick(wasmBytes);
      ResourceLimits.width = BigInt(8192);
      ResourceLimits.height = BigInt(8192);
      ResourceLimits.area = BigInt(32_000_000);
      ResourceLimits.memory = BigInt(64 * 1024 * 1024);
      ResourceLimits.disk = BigInt(0);
      ResourceLimits.listLength = BigInt(1);
      ResourceLimits.time = BigInt(15);
    })().catch((error) => {
      magickInitPromise = null;
      throw error;
    });
  }

  return magickInitPromise;
}

async function processImageWithMagick(input: {
  bytes: Uint8Array;
  sourceMime: AllowedInputImageMime;
  kind: MediaKind;
  maxWidth: number;
  maxHeight: number;
  quality: number;
}): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  await ensureImageMagickInitialized();

  let outputBytes = new Uint8Array();
  let width = 0;
  let height = 0;
  const sourceFormat = SOURCE_MIME_TO_MAGICK_FORMAT[input.sourceMime];

  ImageMagick.read(input.bytes, sourceFormat, (image) => {
    image.autoOrient();
    image.strip();

    const geometry = new MagickGeometry(input.maxWidth, input.maxHeight);
    geometry.greater = true;
    image.resize(geometry);

    image.quality = input.quality;
    width = image.width;
    height = image.height;

    image.write(MagickFormat.WebP, (data) => {
      outputBytes = new Uint8Array(data);
    });
  });

  return { bytes: outputBytes, width, height };
}

function parseProfileRole(
  value: unknown
): CompressImageAuthContext['profileRole'] {
  if (value === 'student' || value === 'officer' || value === 'admin') {
    return value;
  }
  return null;
}

interface CachedRuntime {
  allowedOrigins: string[];
  runtimeEnv: CompressImageRuntimeEnv;
  authClient: ReturnType<typeof createClient>;
  serviceClient: ReturnType<typeof createClient>;
  deps: CompressImageDeps;
}

type RuntimeInitResult =
  | { ok: true; runtime: CachedRuntime }
  | { ok: false; error: string; allowedOrigins: string[] };

let cachedRuntime: CachedRuntime | null = null;

function getOrCreateRuntime(): RuntimeInitResult {
  if (cachedRuntime) {
    return { ok: true, runtime: cachedRuntime };
  }

  let allowedOrigins: string[];
  try {
    allowedOrigins = getAllowedOriginsFromEnv();
  } catch {
    cachedRuntime = null;
    return {
      ok: false,
      error: 'Invalid CORS configuration.',
      allowedOrigins: [],
    };
  }

  const runtimeEnv = resolveRuntimeEnv((key) => Deno.env.get(key));
  if (!runtimeEnv) {
    cachedRuntime = null;
    return {
      ok: false,
      error: 'Server configuration error.',
      allowedOrigins,
    };
  }

  try {
    const authClient = createClient(runtimeEnv.supabaseUrl, runtimeEnv.publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(runtimeEnv.supabaseUrl, runtimeEnv.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const deps: CompressImageDeps = {
      supabaseUrl: runtimeEnv.supabaseUrl,
      expectedJwtIssuer: runtimeEnv.expectedJwtIssuer,
      allowedOrigins,
      verifyUser: async (accessToken: string) => {
        const { data, error } = await authClient.auth.getUser(accessToken);
        if (error || !data.user) {
          return null;
        }
        return {
          id: data.user.id,
          email: data.user.email ?? undefined,
        };
      },
      loadAuthorizationContext: async (userId: string, organizationId: string) => {
        const [profileRes, orgRes, membershipRes] = await Promise.all([
          serviceClient
            .from('profiles')
            .select('role, deleted_at')
            .eq('id', userId)
            .maybeSingle(),
          serviceClient
            .from('organizations')
            .select('id, deleted_at')
            .eq('id', organizationId)
            .maybeSingle(),
          serviceClient
            .from('org_memberships')
            .select('id')
            .eq('profile_id', userId)
            .eq('organization_id', organizationId)
            .eq('role', 'officer')
            .eq('status', 'approved')
            .maybeSingle(),
        ]);

        if (profileRes.error || orgRes.error || membershipRes.error) {
          throw new Error('Failed to load authorization context.');
        }

        const profile = profileRes.data;
        const org = orgRes.data;
        const membership = membershipRes.data;

        return {
          profileRole: parseProfileRole(profile?.role),
          profileActive: profile !== null && profile.deleted_at === null,
          orgExists: org !== null,
          orgActive: org !== null && org.deleted_at === null,
          isApprovedOfficer:
            membership !== null && org !== null && org.deleted_at === null,
        };
      },
      processImage: processImageWithMagick,
      uploadWebp: async ({ bucket, path, bytes, contentType }) => {
        const { error } = await serviceClient.storage.from(bucket).upload(path, bytes, {
          contentType,
          cacheControl: '31536000',
          upsert: false,
        });
        if (error) {
          throw new Error(error.message);
        }

        return {
          publicUrl: buildPublicStorageObjectUrl(
            runtimeEnv.publicStorageBaseUrl,
            bucket,
            path
          ),
        };
      },
      persistOrganizationMediaUrl: async ({ organizationId, kind, publicUrl }) => {
        const { data, error } = await serviceClient
          .from('organizations')
          .update(kind === 'logo' ? { logo_url: publicUrl } : { cover_url: publicUrl })
          .eq('id', organizationId)
          .is('deleted_at', null)
          .select('id')
          .single();
        if (error || !data) {
          throw new Error(error?.message ?? 'Organization not found or inactive.');
        }
      },
      deleteUploadedWebp: async ({ bucket, path }) => {
        const { error } = await serviceClient.storage.from(bucket).remove([path]);
        if (error) {
          throw new Error(error.message);
        }
      },
    };

    cachedRuntime = {
      allowedOrigins,
      runtimeEnv,
      authClient,
      serviceClient,
      deps,
    };

    return { ok: true, runtime: cachedRuntime };
  } catch {
    cachedRuntime = null;
    return {
      ok: false,
      error: 'Server configuration error.',
      allowedOrigins,
    };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const init = getOrCreateRuntime();
  if (!init.ok) {
    return withCorsJson(
      { error: init.error },
      { status: 500 },
      req.headers.get('origin'),
      init.allowedOrigins
    );
  }

  return handleCompressImageRequest(req, init.runtime.deps);
});
