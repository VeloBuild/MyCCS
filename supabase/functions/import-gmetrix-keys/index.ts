import { createClient } from '@supabase/supabase-js';
import { getAllowedOriginsFromEnv, withCorsJson } from '../_shared/cors.ts';
import {
  createImportSecretsResolver,
  createRpcDatabaseAdapter,
  DEFAULT_PUSH_BUDGET_MS,
  handleImportGMetrixKeysRequest,
  parseExpoPushTickets,
  resolveSupabaseRuntimeEnv,
  type CallerProfileRecord,
  type ExpoPushMessage,
  type ExpoPushTicket,
  type ImportGMetrixKeysDeps,
  type SupabaseEdgeRuntimeEnv,
} from './core.ts';

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_TIMEOUT_MS = DEFAULT_PUSH_BUDGET_MS;

function parseProfileRole(value: unknown): CallerProfileRecord['role'] {
  if (value === 'student' || value === 'officer' || value === 'admin') {
    return value;
  }
  return null;
}

function readEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

interface CachedRuntime {
  allowedOrigins: string[];
  runtimeEnv: SupabaseEdgeRuntimeEnv;
  deps: ImportGMetrixKeysDeps;
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
    const dbAdapter = createRpcDatabaseAdapter(serviceClient);
    const loadCryptoSecrets = createImportSecretsResolver({
      readEnv,
      fetchVaultSecrets: dbAdapter.fetchVaultSecrets,
    });

    const deps: ImportGMetrixKeysDeps = {
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
          .select('role, deleted_at')
          .eq('id', userId)
          .maybeSingle();
        if (error) {
          throw new Error('Failed to load caller profile.');
        }
        return {
          role: parseProfileRole(data?.role),
          active: data !== null && data.deleted_at === null,
        };
      },
      loadCertification: async (certificationId: string) => {
        const { data, error } = await serviceClient
          .from('certifications')
          .select('id, is_active')
          .eq('id', certificationId)
          .maybeSingle();
        if (error) {
          throw new Error('Failed to load certification.');
        }
        if (!data) {
          return null;
        }
        return { id: String(data.id), isActive: data.is_active === true };
      },
      loadCryptoSecrets,
      lookupProfilesByBlindIndexes: dbAdapter.lookupProfilesByBlindIndexes,
      commitBatch: dbAdapter.commitBatch,
      loadPushTokens: dbAdapter.loadPushTokens,
      deletePushTokens: dbAdapter.deletePushTokens,
      sendExpoPushBatch: async (
        messages: readonly ExpoPushMessage[],
        options?: { timeoutMs?: number }
      ): Promise<ExpoPushTicket[]> => {
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        };
        const expoAccessToken = readEnv('EXPO_ACCESS_TOKEN')?.trim();
        if (expoAccessToken) {
          headers.Authorization = `Bearer ${expoAccessToken}`;
        }

        const timeoutMs = Math.min(
          EXPO_PUSH_TIMEOUT_MS,
          Math.max(1, Math.floor(options?.timeoutMs ?? EXPO_PUSH_TIMEOUT_MS))
        );
        const response = await fetch(EXPO_PUSH_API_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(messages),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) {
          throw new Error(`Expo Push API returned HTTP ${response.status}.`);
        }

        return parseExpoPushTickets(await response.json());
      },
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
      { status: 500 },
      req.headers.get('origin'),
      init.allowedOrigins
    );
  }

  return handleImportGMetrixKeysRequest(req, init.runtime.deps);
});
