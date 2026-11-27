import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import {
  isSecretSupabaseKeyPrefix,
  isSupabaseServiceRoleJwt,
} from '../../shared/supabase-key-guard';

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
  };
};

export const SECURE_STORE_CHUNK_BYTES = 1800;

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface SupabaseStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function utf8CodePointBytes(codePoint: number): number {
  if (codePoint <= 0x7f) {
    return 1;
  }
  if (codePoint <= 0x7ff) {
    return 2;
  }
  if (codePoint <= 0xffff) {
    return 3;
  }
  return 4;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    bytes += utf8CodePointBytes(char.codePointAt(0) ?? 0);
  }
  return bytes;
}

/**
 * Splits a UTF-8 string into chunks without exceeding `maxBytes` UTF-8 bytes
 * or splitting multi-byte code points across chunk boundaries.
 */
export function chunkUtf8(value: string, maxBytes: number): string[] {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError('maxBytes must be a positive integer.');
  }
  if (utf8ByteLength(value) <= maxBytes) {
    return [value];
  }

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of value) {
    const charBytes = utf8CodePointBytes(char.codePointAt(0) ?? 0);
    if (charBytes > maxBytes) {
      throw new RangeError(
        `Character byte length (${charBytes}) exceeds chunk limit (${maxBytes}).`
      );
    }
    if (currentBytes + charBytes > maxBytes) {
      chunks.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function chunkCountKey(key: string): string {
  return `${key}.__chunks`;
}

function chunkItemKey(key: string, index: number): string {
  return `${key}.__chunk_${index}`;
}

function parseChunkCount(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }
  const count = Number.parseInt(raw, 10);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

/**
 * Adapts Expo SecureStore to Supabase Auth's asynchronous session storage contract
 * with transparent UTF-8-safe chunking for sessions exceeding SecureStore's 2048-byte limit.
 */
export function createSecureStoreAdapter(
  store: SecureStoreLike = SecureStore
): SupabaseStorageAdapter {
  return {
    getItem: async (key) => {
      const rawCount = await store.getItemAsync(chunkCountKey(key));
      if (rawCount === null) {
        return store.getItemAsync(key);
      }

      const count = parseChunkCount(rawCount);
      if (count === null) {
        return null;
      }

      const chunks: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const chunk = await store.getItemAsync(chunkItemKey(key, i));
        if (chunk === null) {
          return null;
        }
        chunks.push(chunk);
      }

      return chunks.join('');
    },
    setItem: async (key, value) => {
      const oldCount = parseChunkCount(await store.getItemAsync(chunkCountKey(key)));

      if (utf8ByteLength(value) <= SECURE_STORE_CHUNK_BYTES) {
        await store.setItemAsync(key, value);
        await store.deleteItemAsync(chunkCountKey(key));
        if (oldCount !== null) {
          for (let i = 0; i < oldCount; i += 1) {
            await store.deleteItemAsync(chunkItemKey(key, i));
          }
        }
        return;
      }

      const chunks = chunkUtf8(value, SECURE_STORE_CHUNK_BYTES);
      for (let i = 0; i < chunks.length; i += 1) {
        await store.setItemAsync(chunkItemKey(key, i), chunks[i]);
      }
      await store.setItemAsync(chunkCountKey(key), String(chunks.length));
      if (oldCount !== null) {
        for (let i = chunks.length; i < oldCount; i += 1) {
          await store.deleteItemAsync(chunkItemKey(key, i));
        }
      }
      await store.deleteItemAsync(key);
    },
    removeItem: async (key) => {
      const count = parseChunkCount(await store.getItemAsync(chunkCountKey(key)));
      if (count !== null) {
        for (let i = 0; i < count; i += 1) {
          await store.deleteItemAsync(chunkItemKey(key, i));
        }
      }
      await store.deleteItemAsync(chunkCountKey(key));
      await store.deleteItemAsync(key);
    },
  };
}

export const expoSecureStoreAdapter = createSecureStoreAdapter(SecureStore);

function readClientSupabaseUrl(): string | undefined {
  if (typeof process === 'undefined') {
    return undefined;
  }
  return process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

function readClientPublishableKey(): string | undefined {
  if (typeof process === 'undefined') {
    return undefined;
  }
  return (
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );
}

function assertMobilePublishableKey(publishableKey: string): void {
  if (isSecretSupabaseKeyPrefix(publishableKey)) {
    throw new Error('SUPABASE_SECRET_KEY must never be used in the mobile client.');
  }

  if (isSupabaseServiceRoleJwt(publishableKey)) {
    throw new Error('Supabase service_role JWT must never be used in the mobile client.');
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(readClientSupabaseUrl() && readClientPublishableKey());
}

export function getClientSupabaseConfig(): {
  supabaseUrl: string;
  publishableKey: string;
} {
  const supabaseUrl = readClientSupabaseUrl();
  const publishableKey = readClientPublishableKey();
  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY (or EXPO_PUBLIC_* equivalents).'
    );
  }

  assertMobilePublishableKey(publishableKey);
  return { supabaseUrl, publishableKey };
}

export function createMyCcsSupabaseClient(
  url = readClientSupabaseUrl(),
  publishableKey = readClientPublishableKey(),
  storage: SupabaseStorageAdapter = expoSecureStoreAdapter
): SupabaseClient {
  if (!url || !publishableKey) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY (or EXPO_PUBLIC_* equivalents).'
    );
  }

  assertMobilePublishableKey(publishableKey);

  return createClient(url, publishableKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createMyCcsSupabaseClient();
  }
  return cachedClient;
}

export function resetSupabaseClientForTesting(): void {
  cachedClient = null;
}
