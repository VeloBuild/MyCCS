import { createClient } from '@supabase/supabase-js';
import { getAllowedOriginsFromEnv, withCorsJson } from '../_shared/cors.ts';
import {
  createMyKeysRingResolver,
  handleMyCertificationKeysRequest,
  loadAllPaginatedCertificationKeyRows,
  resolveSupabaseRuntimeEnv,
  type EncryptedCertificationKeyRow,
  type MyCertificationKeysDeps,
  type SupabaseEdgeRuntimeEnv,
} from './core.ts';

function readEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

interface CachedRuntime {
  allowedOrigins: string[];
  runtimeEnv: SupabaseEdgeRuntimeEnv;
  deps: MyCertificationKeysDeps;
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
    return { ok: false, error: 'Invalid CORS configuration.', allowedOrigins: [] };
  }

  const runtimeEnv = resolveSupabaseRuntimeEnv(readEnv);
  if (!runtimeEnv) {
    cachedRuntime = null;
    return { ok: false, error: 'Server configuration error.', allowedOrigins };
  }

  try {
    const authClient = createClient(runtimeEnv.supabaseUrl, runtimeEnv.publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(runtimeEnv.supabaseUrl, runtimeEnv.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const loadKeyRing = createMyKeysRingResolver({
      readEnv,
      fetchVaultSecrets: async (params) => {
        const { data, error } = await serviceClient.rpc('get_gmetrix_runtime_secrets', params);
        if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
          return null;
        }
        return data as { certKeyEncryptionKey?: string | null };
      },
    });

    const deps: MyCertificationKeysDeps = {
      supabaseUrl: runtimeEnv.supabaseUrl,
      expectedJwtIssuer: runtimeEnv.expectedJwtIssuer,
      allowedOrigins,
      verifyUser: async (accessToken: string) => {
        const { data, error } = await authClient.auth.getUser(accessToken);
        if (error || !data.user) {
          return null;
        }
        return { id: data.user.id, email: data.user.email ?? undefined };
      },
      loadCallerProfile: async (userId: string) => {
        const { data, error } = await serviceClient
          .from('profiles')
          .select('id, deleted_at')
          .eq('id', userId)
          .maybeSingle();
        if (error) {
          throw new Error('Failed to load caller profile.');
        }
        return { active: data !== null && data.deleted_at === null };
      },
      loadKeyRing,
      loadOwnEncryptedKeys: async (userId: string): Promise<EncryptedCertificationKeyRow[]> =>
        loadAllPaginatedCertificationKeyRows(async (from, to) => {
          const { data, error, count } = await serviceClient
            .from('certification_keys')
            .select(
              'id, batch_id, certification_id, key_code_enc, key_version, assigned_at, viewed_at, certifications!inner(title, provider)',
              { count: 'exact' }
            )
            .eq('student_profile_id', userId)
            .order('assigned_at', { ascending: false })
            .order('id', { ascending: false })
            .range(from, to);
          if (error) {
            throw new Error('Failed to query certification keys.');
          }
          return {
            rows: data ?? [],
            count,
          };
        }),
    };

    cachedRuntime = { allowedOrigins, runtimeEnv, deps };
    return { ok: true, runtime: cachedRuntime };
  } catch {
    cachedRuntime = null;
    return { ok: false, error: 'Server configuration error.', allowedOrigins };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const init = getOrCreateRuntime();
  if (!init.ok) {
    return withCorsJson(
      { error: init.error },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
      req.headers.get('origin'),
      init.allowedOrigins
    );
  }

  return handleMyCertificationKeysRequest(req, init.runtime.deps);
});
