import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  CertificationSchema,
  DecryptedCertificationKeySchema,
  NotificationSchema,
  type Certification,
  type DecryptedCertificationKey,
  type Notification,
} from '../../shared/gmetrix';
import { assertPublishableClientKey } from '../../shared/supabase-key-guard';

const UuidSchema = z.string().uuid();
const IsoTimestampSchema = z.string().datetime({ offset: true });

export const DEFAULT_NOTIFICATIONS_LIMIT = 50;
export const MAX_NOTIFICATIONS_LIMIT = 200;

const CERTIFICATION_COLUMNS =
  'id, title, provider, description, is_active, created_at';
const NOTIFICATION_COLUMNS =
  'id, profile_id, type, title, body, deep_link, read_at, created_at';
const CERTIFICATION_KEY_VIEWED_COLUMNS = 'id, viewed_at';

const CertificationKeyViewedRowSchema = z
  .object({
    id: UuidSchema,
    viewed_at: IsoTimestampSchema,
  })
  .strict();

const MyCertificationKeysEnvelopeSchema = z.object({
  keys: z.array(DecryptedCertificationKeySchema),
});

export type FetchLike = typeof fetch;

export interface CertificationsQueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export interface CertificationsListTerminal
  extends PromiseLike<CertificationsQueryResult<unknown[]>> {
  order(
    column: string,
    options?: { ascending?: boolean }
  ): CertificationsListTerminal;
  limit(count: number): PromiseLike<CertificationsQueryResult<unknown[]>>;
}

export interface CertificationsSelectEqChain
  extends PromiseLike<CertificationsQueryResult<unknown[]>> {
  order(
    column: string,
    options?: { ascending?: boolean }
  ): CertificationsListTerminal;
}

export interface CertificationsUpdateChain {
  eq(
    column: string,
    value: unknown
  ): {
    is(
      column: string,
      value: null
    ): {
      select(columns?: string): PromiseLike<CertificationsQueryResult<unknown[]>>;
    };
  };
}

export interface CertificationsTableBuilder {
  select(columns?: string): {
    eq(column: string, value: unknown): CertificationsSelectEqChain;
  };
  update(values: Record<string, unknown>): CertificationsUpdateChain;
}

export interface CertificationsSupabaseClient {
  from(relation: string): CertificationsTableBuilder;
  auth?: {
    getSession(): Promise<{
      data: { session: { access_token?: string } | null };
      error: { message: string } | null;
    }>;
  };
}

export interface MarkedCertificationKeyView {
  id: string;
  viewedAt: string;
}

export interface FetchMyDecryptedCertificationKeysParams {
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
  fetchFn?: FetchLike;
}

export function adaptCertificationsSupabaseClient(
  client: SupabaseClient
): CertificationsSupabaseClient {
  return client as unknown as CertificationsSupabaseClient;
}

function assertHttpBaseUrl(rawUrl: string): string {
  const normalized = rawUrl.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Supabase URL must use http or https protocol.');
    }
  } catch {
    throw new Error('Supabase URL must use http or https protocol.');
  }
  return normalized;
}

export async function fetchActiveCertifications(
  client: CertificationsSupabaseClient
): Promise<Certification[]> {
  const { data, error } = await client
    .from('certifications')
    .select(CERTIFICATION_COLUMNS)
    .eq('is_active', true)
    .order('provider', { ascending: true })
    .order('title', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => CertificationSchema.parse(row));
}

export async function fetchMyNotifications(
  client: CertificationsSupabaseClient,
  profileId: string,
  limit = DEFAULT_NOTIFICATIONS_LIMIT
): Promise<Notification[]> {
  const parsedProfileId = UuidSchema.parse(profileId);
  const effectiveLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, MAX_NOTIFICATIONS_LIMIT)
      : DEFAULT_NOTIFICATIONS_LIMIT;

  const { data, error } = await client
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('profile_id', parsedProfileId)
    .order('created_at', { ascending: false })
    .limit(effectiveLimit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => NotificationSchema.parse(row));
}

export async function markNotificationRead(
  client: CertificationsSupabaseClient,
  notificationId: string,
  readAtIso?: string
): Promise<Notification | null> {
  const parsedId = UuidSchema.parse(notificationId);
  const effectiveReadAt =
    readAtIso !== undefined
      ? IsoTimestampSchema.parse(readAtIso)
      : new Date().toISOString();

  const { data, error } = await client
    .from('notifications')
    .update({ read_at: effectiveReadAt })
    .eq('id', parsedId)
    .is('read_at', null)
    .select(NOTIFICATION_COLUMNS);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return null;
  }

  return NotificationSchema.parse(data[0]);
}

export async function markCertificationKeyViewed(
  client: CertificationsSupabaseClient,
  keyId: string,
  viewedAtIso?: string
): Promise<MarkedCertificationKeyView | null> {
  const parsedKeyId = UuidSchema.parse(keyId);
  const effectiveViewedAt =
    viewedAtIso !== undefined
      ? IsoTimestampSchema.parse(viewedAtIso)
      : new Date().toISOString();

  const { data, error } = await client
    .from('certification_keys')
    .update({ viewed_at: effectiveViewedAt })
    .eq('id', parsedKeyId)
    .is('viewed_at', null)
    .select(CERTIFICATION_KEY_VIEWED_COLUMNS);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return null;
  }

  const parsed = CertificationKeyViewedRowSchema.parse(data[0]);
  return {
    id: parsed.id,
    viewedAt: parsed.viewed_at,
  };
}

export async function fetchMyDecryptedCertificationKeys(
  params: FetchMyDecryptedCertificationKeysParams
): Promise<DecryptedCertificationKey[]> {
  const accessToken = params.accessToken.trim();
  if (accessToken.length === 0) {
    throw new Error('Authenticated session access token is required.');
  }

  const normalizedBaseUrl = assertHttpBaseUrl(params.supabaseUrl);

  const publishableKey = params.publishableKey.trim();
  if (publishableKey.length === 0) {
    throw new Error('Supabase publishable key is required.');
  }
  assertPublishableClientKey(publishableKey, 'SUPABASE_PUBLISHABLE_KEY');

  const fetchFn = params.fetchFn ?? globalThis.fetch;
  const response = await fetchFn(
    `${normalizedBaseUrl}/functions/v1/my-certification-keys`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: publishableKey,
      },
    }
  );

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const serverError =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Failed to load certification keys (${response.status}).`;
    throw new Error(serverError);
  }

  return MyCertificationKeysEnvelopeSchema.parse(payload).keys;
}
