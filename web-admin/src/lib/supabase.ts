import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { WebAdminEnvSchema } from '@shared/web-admin';

export interface WebAdminSupabaseConfig {
  supabaseUrl: string;
  publishableKey: string;
}

let cachedConfig: WebAdminSupabaseConfig | null = null;
let cachedClient: SupabaseClient | null = null;

export function getWebAdminSupabaseConfig(): WebAdminSupabaseConfig {
  if (!cachedConfig) {
    const rawEnv = import.meta.env as Record<string, unknown>;
    const env = WebAdminEnvSchema.parse({
      VITE_SUPABASE_URL: rawEnv.VITE_SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: rawEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
    });

    cachedConfig = {
      supabaseUrl: env.VITE_SUPABASE_URL.replace(/\/+$/, ''),
      publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
  }
  return cachedConfig;
}

export function getWebAdminSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    const config = getWebAdminSupabaseConfig();

    cachedClient = createClient(config.supabaseUrl, config.publishableKey, {
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
