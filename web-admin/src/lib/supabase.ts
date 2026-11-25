import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { WebAdminEnvSchema } from '@shared/web-admin';

let cachedClient: SupabaseClient | null = null;

export function getWebAdminSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    const rawEnv = import.meta.env as Record<string, unknown>;
    const env = WebAdminEnvSchema.parse({
      VITE_SUPABASE_URL: rawEnv.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    });

    cachedClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: 'pkce',
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedClient;
}
