import { createElement } from 'react';
import {
  act,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Linking } from 'react-native';
import appConfig from '../../app.json';
import type { PublicProfileDto } from '../../shared/auth';
import {
  GMETRIX_MY_KEYS_DEEP_LINK,
  GMETRIX_PUSH_BODY,
  GMETRIX_PUSH_TITLE,
  maskCertificationKey,
  type Certification,
  type DecryptedCertificationKey,
  type Notification,
} from '../../shared/gmetrix';
import { CertificationsAndKeysView } from '../../src/components/CertificationsAndKeysView';
import * as supabaseLib from '../../src/lib/supabase';
import { MyCcsHubScreen } from '../../src/screens/MyCcsHubScreen';
import {
  DEFAULT_NOTIFICATIONS_LIMIT,
  MAX_NOTIFICATIONS_LIMIT,
  fetchActiveCertifications,
  fetchMyDecryptedCertificationKeys,
  fetchMyNotifications,
  markCertificationKeyViewed,
  markNotificationRead,
  type CertificationsQueryResult,
  type CertificationsSupabaseClient,
} from '../../src/services/certifications';
import {
  registerDevicePushToken,
  resolveDeepLinkToHubRoute,
  subscribeToNotificationDeepLinks,
  syncDevicePushToken,
  unregisterDevicePushToken,
  type LinkingLike,
  type PushTokenDriver,
  type PushTokensRpcClient,
} from '../../src/services/pushNotifications';

declare const process: {
  env: Record<string, string | undefined>;
};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
    WEBP: 'webp',
  },
  ImageManipulator: {
    manipulate: jest.fn(),
  },
}));

const STUDENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CERT_COMPTIA_ID = '11111111-1111-4111-8111-111111111111';
const CERT_CISCO_ID = '22222222-2222-4222-8222-222222222222';
const CERT_INACTIVE_ID = '33333333-3333-4333-8333-333333333333';
const BATCH_ID = '44444444-4444-4444-8444-444444444444';
const KEY_NEW_ID = '55555555-5555-4555-8555-555555555551';
const KEY_VIEWED_ID = '55555555-5555-4555-8555-555555555552';
const NOTIF_UNREAD_ID = '66666666-6666-4666-8666-666666666661';
const NOTIF_READ_ID = '66666666-6666-4666-8666-666666666662';
const PUSH_TOKEN_ROW_ID = '77777777-7777-4777-8777-777777777771';

const VALID_PUSH_TOKEN = 'ExponentPushToken[MyCcsDeviceToken_0123456789]';

const STUDENT_PROFILE: PublicProfileDto = {
  id: STUDENT_ID,
  email: 'student@lpunetwork.edu.ph',
  fullName: 'Juan Dela Cruz',
  role: 'student',
  qrToken: `v1.${STUDENT_ID}.0123456789abcdef01234567`,
  keyVersion: 1,
};

const SAMPLE_CERTIFICATIONS: Certification[] = [
  {
    id: CERT_CISCO_ID,
    title: 'CCNA Switching and Routing',
    provider: 'Cisco',
    description: 'Networking fundamentals and enterprise routing practice.',
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: CERT_COMPTIA_ID,
    title: 'CompTIA Security+ Practice Suite',
    provider: 'CompTIA',
    description: 'GMetrix exam readiness for SY0-701 certification.',
    is_active: true,
    created_at: '2026-11-02T00:00:00.000Z',
  },
  {
    id: CERT_INACTIVE_ID,
    title: 'Retired Legacy Track',
    provider: 'Certiport',
    description: 'Archived certification track.',
    is_active: false,
    created_at: '2026-10-01T00:00:00.000Z',
  },
];

const SAMPLE_KEYS: DecryptedCertificationKey[] = [
  {
    id: KEY_NEW_ID,
    batchId: BATCH_ID,
    certificationId: CERT_COMPTIA_ID,
    certificationTitle: 'CompTIA Security+ Practice Suite',
    certificationProvider: 'CompTIA',
    keyCode: 'GMX-SEC701-9988-ABCD',
    keyVersion: 1,
    assignedAt: '2026-11-27T08:00:00.000Z',
    viewedAt: null,
  },
  {
    id: KEY_VIEWED_ID,
    batchId: BATCH_ID,
    certificationId: CERT_CISCO_ID,
    certificationTitle: 'CCNA Switching and Routing',
    certificationProvider: 'Cisco',
    keyCode: 'GMX-CCNA-4411-WXYZ',
    keyVersion: 1,
    assignedAt: '2026-11-20T08:00:00.000Z',
    viewedAt: '2026-11-21T09:30:00.000Z',
  },
];

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: NOTIF_UNREAD_ID,
    profile_id: STUDENT_ID,
    type: 'gmetrix_key',
    title: GMETRIX_PUSH_TITLE,
    body: GMETRIX_PUSH_BODY,
    deep_link: GMETRIX_MY_KEYS_DEEP_LINK,
    read_at: null,
    created_at: '2026-11-27T08:05:00.000Z',
  },
  {
    id: NOTIF_READ_ID,
    profile_id: STUDENT_ID,
    type: 'event',
    title: 'CCS Tech Week Schedule',
    body: 'Department symposium schedule has been posted.',
    deep_link: 'myccs://events/ccs-tech-week',
    read_at: '2026-11-26T10:00:00.000Z',
    created_at: '2026-11-25T10:00:00.000Z',
  },
];

interface MockCertDbState {
  certifications: Certification[];
  notifications: Notification[];
  keyViewedAtById: Record<string, string | null>;
  failTable?: string;
  failErrorMessage?: string;
  sessionAccessToken?: string | null;
  onFetchNotifications?: () => Promise<
    CertificationsQueryResult<unknown[]> | undefined
  >;
}

function createMockCertificationsClient(initial: MockCertDbState): {
  client: CertificationsSupabaseClient;
  state: MockCertDbState;
  spies: {
    certOrders: jest.Mock;
    notifLimit: jest.Mock;
    markNotificationRead: jest.Mock;
    markKeyViewed: jest.Mock;
  };
} {
  const state: MockCertDbState = {
    certifications: initial.certifications.map((c) => ({ ...c })),
    notifications: initial.notifications.map((n) => ({ ...n })),
    keyViewedAtById: { ...initial.keyViewedAtById },
    failTable: initial.failTable,
    failErrorMessage: initial.failErrorMessage,
    sessionAccessToken:
      initial.sessionAccessToken === undefined
        ? 'jwt-student-session'
        : initial.sessionAccessToken,
    onFetchNotifications: initial.onFetchNotifications,
  };

  const spies = {
    certOrders: jest.fn(),
    notifLimit: jest.fn(),
    markNotificationRead: jest.fn(),
    markKeyViewed: jest.fn(),
  };

  const client: CertificationsSupabaseClient = {
    auth: {
      getSession: jest.fn(async () => ({
        data: {
          session: state.sessionAccessToken
            ? { access_token: state.sessionAccessToken }
            : null,
        },
        error: null,
      })),
    },
    from(relation: string) {
      const makeError = () =>
        state.failTable === relation
          ? { message: state.failErrorMessage ?? `Failed query on ${relation}` }
          : null;

      return {
        select() {
          return {
            eq(col: string, val: unknown) {
              const orderSpecs: Array<{ column: string; ascending: boolean }> = [];

              const resolveRows = async (
                limitCount?: number
              ): Promise<CertificationsQueryResult<unknown[]>> => {
                const err = makeError();
                if (err) {
                  return { data: null, error: err };
                }

                if (relation === 'certifications') {
                  spies.certOrders([...orderSpecs]);
                  let rows = state.certifications.filter(
                    (c) =>
                      (c as unknown as Record<string, unknown>)[col] === val
                  );
                  rows = [...rows].sort((a, b) => {
                    for (const spec of orderSpecs) {
                      const av = String(
                        (a as unknown as Record<string, unknown>)[spec.column] ??
                          ''
                      );
                      const bv = String(
                        (b as unknown as Record<string, unknown>)[spec.column] ??
                          ''
                      );
                      const cmp = av.localeCompare(bv);
                      if (cmp !== 0) {
                        return spec.ascending ? cmp : -cmp;
                      }
                    }
                    return 0;
                  });
                  return {
                    data:
                      limitCount !== undefined ? rows.slice(0, limitCount) : rows,
                    error: null,
                  };
                }

                if (relation === 'notifications') {
                  if (state.onFetchNotifications) {
                    const override = await state.onFetchNotifications();
                    if (override !== undefined) {
                      return override;
                    }
                  }
                  let rows = state.notifications.filter(
                    (n) =>
                      (n as unknown as Record<string, unknown>)[col] === val
                  );
                  rows = [...rows].sort((a, b) => {
                    for (const spec of orderSpecs) {
                      const av = String(
                        (a as unknown as Record<string, unknown>)[spec.column] ??
                          ''
                      );
                      const bv = String(
                        (b as unknown as Record<string, unknown>)[spec.column] ??
                          ''
                      );
                      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
                      if (cmp !== 0) {
                        return spec.ascending ? cmp : -cmp;
                      }
                    }
                    return 0;
                  });
                  return {
                    data:
                      limitCount !== undefined ? rows.slice(0, limitCount) : rows,
                    error: null,
                  };
                }

                return { data: [], error: null };
              };

              const makeTerminal = () => ({
                then<T1 = CertificationsQueryResult<unknown[]>, T2 = never>(
                  onfulfilled?:
                    | ((
                        value: CertificationsQueryResult<unknown[]>
                      ) => T1 | PromiseLike<T1>)
                    | null,
                  onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null
                ) {
                  return resolveRows().then(onfulfilled, onrejected);
                },
                order(column: string, options?: { ascending?: boolean }) {
                  orderSpecs.push({
                    column,
                    ascending: options?.ascending ?? true,
                  });
                  return makeTerminal();
                },
                limit(count: number) {
                  if (relation === 'notifications') {
                    spies.notifLimit(count);
                  }
                  return resolveRows(count);
                },
              });

              return makeTerminal();
            },
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq(eqCol: string, eqVal: unknown) {
              return {
                is(isCol: string, _isVal: null) {
                  return {
                    select: async () => {
                      const err = makeError();
                      if (err) {
                        return { data: null, error: err };
                      }

                      if (
                        relation === 'notifications' &&
                        eqCol === 'id' &&
                        isCol === 'read_at'
                      ) {
                        const target = state.notifications.find(
                          (item) => item.id === eqVal
                        );
                        spies.markNotificationRead(eqVal, values.read_at);
                        if (!target || target.read_at !== null) {
                          return { data: [], error: null };
                        }
                        target.read_at = String(values.read_at);
                        return { data: [{ ...target }], error: null };
                      }

                      if (
                        relation === 'certification_keys' &&
                        eqCol === 'id' &&
                        isCol === 'viewed_at'
                      ) {
                        const keyId = String(eqVal);
                        spies.markKeyViewed(keyId, values.viewed_at);
                        if (
                          !Object.prototype.hasOwnProperty.call(
                            state.keyViewedAtById,
                            keyId
                          ) ||
                          state.keyViewedAtById[keyId] !== null
                        ) {
                          return { data: [], error: null };
                        }
                        const viewedAt = String(values.viewed_at);
                        state.keyViewedAtById[keyId] = viewedAt;
                        return {
                          data: [{ id: keyId, viewed_at: viewedAt }],
                          error: null,
                        };
                      }

                      return { data: [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return { client, state, spies };
}

function createMockPushTokensClient(options?: {
  rpcError?: string;
  deleteError?: string;
  onDelete?: (
    col: string,
    val: unknown
  ) => Promise<{ error: { message: string } | null }>;
}): {
  client: PushTokensRpcClient;
  rpcMock: jest.Mock;
  deleteEqMock: jest.Mock;
} {
  const rpcMock = jest.fn(
    async (_fn: string, params?: Record<string, unknown>) => {
      if (options?.rpcError) {
        return { data: null, error: { message: options.rpcError } };
      }
      return {
        data: {
          id: PUSH_TOKEN_ROW_ID,
          expoPushToken: params?.p_expo_push_token,
          platform: params?.p_platform,
          updatedAt: '2026-11-28T05:00:00.000Z',
        },
        error: null,
      };
    }
  );
  const deleteEqMock = jest.fn(async (col: string, val: unknown) => {
    if (options?.onDelete) {
      return options.onDelete(col, val);
    }
    return {
      error: options?.deleteError ? { message: options.deleteError } : null,
    };
  });

  const client: PushTokensRpcClient = {
    rpc: rpcMock,
    from: jest.fn(() => ({
      delete: jest.fn(() => ({
        eq: deleteEqMock,
      })),
    })),
  };

  return { client, rpcMock, deleteEqMock };
}

function createFakeLinking(initialUrl: string | null = null): {
  linking: LinkingLike;
  emitUrl: (url: string) => void;
  removeSpy: jest.Mock;
} {
  let listener: ((event: { url: string }) => void) | null = null;
  const removeSpy = jest.fn(() => {
    listener = null;
  });

  const linking: LinkingLike = {
    getInitialURL: jest.fn(async () => initialUrl),
    addEventListener: jest.fn((_type, cb) => {
      listener = cb;
      return { remove: removeSpy };
    }),
  };

  return {
    linking,
    emitUrl: (url: string) => {
      listener?.({ url });
    },
    removeSpy,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const SUPABASE_ENV_KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
] as const;

describe('spec-05-gmetrix-csv-and-push (SCRUM-14) — Mobile Keys, Alerts & Push', () => {
  let savedEnv: Record<(typeof SUPABASE_ENV_KEYS)[number], string | undefined>;

  beforeEach(() => {
    savedEnv = {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    };
    for (const key of SUPABASE_ENV_KEYS) {
      delete process.env[key];
    }
    supabaseLib.resetSupabaseClientForTesting();
  });

  afterEach(() => {
    for (const key of SUPABASE_ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    jest.restoreAllMocks();
  });

  describe('app.json deep-link scheme', () => {
    it('configures the myccs custom URL scheme under expo', () => {
      expect(appConfig.expo.scheme).toBe('myccs');
    });
  });

  describe('src/services/certifications.ts', () => {
    it('fetches active certifications ordered by provider then title', async () => {
      const { client, spies } = createMockCertificationsClient({
        certifications: SAMPLE_CERTIFICATIONS,
        notifications: [],
        keyViewedAtById: {},
      });

      const certs = await fetchActiveCertifications(client);
      expect(certs).toHaveLength(2);
      expect(certs.map((c) => c.provider)).toEqual(['Cisco', 'CompTIA']);
      expect(spies.certOrders).toHaveBeenCalledWith([
        { column: 'provider', ascending: true },
        { column: 'title', ascending: true },
      ]);
    });

    it('propagates errors from fetchActiveCertifications', async () => {
      const { client } = createMockCertificationsClient({
        certifications: [],
        notifications: [],
        keyViewedAtById: {},
        failTable: 'certifications',
        failErrorMessage: 'RLS denied certifications',
      });

      await expect(fetchActiveCertifications(client)).rejects.toThrow(
        'RLS denied certifications'
      );
    });

    it('fetches caller notifications newest-first with default and bounded limits', async () => {
      const { client, spies } = createMockCertificationsClient({
        certifications: [],
        notifications: SAMPLE_NOTIFICATIONS,
        keyViewedAtById: {},
      });

      const defaultRows = await fetchMyNotifications(client, STUDENT_ID);
      expect(defaultRows.map((n) => n.id)).toEqual([
        NOTIF_UNREAD_ID,
        NOTIF_READ_ID,
      ]);
      expect(spies.notifLimit).toHaveBeenLastCalledWith(
        DEFAULT_NOTIFICATIONS_LIMIT
      );

      const singleRow = await fetchMyNotifications(client, STUDENT_ID, 1);
      expect(singleRow).toHaveLength(1);
      expect(spies.notifLimit).toHaveBeenLastCalledWith(1);

      await fetchMyNotifications(client, STUDENT_ID, 999);
      expect(spies.notifLimit).toHaveBeenLastCalledWith(MAX_NOTIFICATIONS_LIMIT);

      await fetchMyNotifications(client, STUDENT_ID, 0);
      expect(spies.notifLimit).toHaveBeenLastCalledWith(
        DEFAULT_NOTIFICATIONS_LIMIT
      );

      await expect(fetchMyNotifications(client, 'not-a-uuid')).rejects.toThrow();
    });

    it('marks unread notifications read once and handles already-read idempotently', async () => {
      const { client } = createMockCertificationsClient({
        certifications: [],
        notifications: SAMPLE_NOTIFICATIONS,
        keyViewedAtById: {},
      });

      const readAt = '2026-11-28T05:10:00.000Z';
      const updated = await markNotificationRead(client, NOTIF_UNREAD_ID, readAt);
      expect(updated).not.toBeNull();
      expect(updated?.read_at).toBe(readAt);

      const secondCall = await markNotificationRead(
        client,
        NOTIF_UNREAD_ID,
        '2026-11-28T05:20:00.000Z'
      );
      expect(secondCall).toBeNull();
    });

    it('marks unviewed certification keys viewed once and handles already-viewed idempotently', async () => {
      const { client } = createMockCertificationsClient({
        certifications: [],
        notifications: [],
        keyViewedAtById: {
          [KEY_NEW_ID]: null,
          [KEY_VIEWED_ID]: '2026-11-21T09:30:00.000Z',
        },
      });

      const viewedAt = '2026-11-28T05:15:00.000Z';
      const first = await markCertificationKeyViewed(client, KEY_NEW_ID, viewedAt);
      expect(first).toEqual({ id: KEY_NEW_ID, viewedAt });

      const second = await markCertificationKeyViewed(
        client,
        KEY_NEW_ID,
        '2026-11-28T05:25:00.000Z'
      );
      expect(second).toBeNull();

      const alreadyViewed = await markCertificationKeyViewed(
        client,
        KEY_VIEWED_ID,
        viewedAt
      );
      expect(alreadyViewed).toBeNull();
    });

    it('fetches decrypted certification keys with Bearer + apikey headers and validates schema', async () => {
      const fetchFn = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ keys: SAMPLE_KEYS }),
      });

      const keys = await fetchMyDecryptedCertificationKeys({
        accessToken: 'jwt-valid-student',
        supabaseUrl: 'https://myccs.supabase.co///',
        publishableKey: 'sb_publishable_test_key',
        fetchFn: fetchFn as unknown as typeof fetch,
      });

      expect(keys).toEqual(SAMPLE_KEYS);
      expect(fetchFn).toHaveBeenCalledWith(
        'https://myccs.supabase.co/functions/v1/my-certification-keys',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer jwt-valid-student',
            apikey: 'sb_publishable_test_key',
          },
        }
      );
    });

    it('rejects missing token, invalid URL, secret/service_role keys, non-OK responses, and invalid payloads', async () => {
      const fetchFn = jest.fn();

      await expect(
        fetchMyDecryptedCertificationKeys({
          accessToken: '   ',
          supabaseUrl: 'https://myccs.supabase.co',
          publishableKey: 'sb_publishable_ok',
          fetchFn: fetchFn as unknown as typeof fetch,
        })
      ).rejects.toThrow(/access token/i);

      await expect(
        fetchMyDecryptedCertificationKeys({
          accessToken: 'jwt-token',
          supabaseUrl: 'ftp://myccs.supabase.co',
          publishableKey: 'sb_publishable_ok',
          fetchFn: fetchFn as unknown as typeof fetch,
        })
      ).rejects.toThrow(/http or https/i);

      await expect(
        fetchMyDecryptedCertificationKeys({
          accessToken: 'jwt-token',
          supabaseUrl: 'https://myccs.supabase.co',
          publishableKey: 'sb_secret_forbidden',
          fetchFn: fetchFn as unknown as typeof fetch,
        })
      ).rejects.toThrow(/sb_secret/i);

      expect(fetchFn).not.toHaveBeenCalled();

      fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ error: 'Invalid session JWT.' }),
      });
      await expect(
        fetchMyDecryptedCertificationKeys({
          accessToken: 'jwt-expired',
          supabaseUrl: 'https://myccs.supabase.co',
          publishableKey: 'sb_publishable_ok',
          fetchFn: fetchFn as unknown as typeof fetch,
        })
      ).rejects.toThrow('Invalid session JWT.');

      fetchFn.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: jest.fn().mockRejectedValue(new Error('not json')),
      });
      await expect(
        fetchMyDecryptedCertificationKeys({
          accessToken: 'jwt-ok',
          supabaseUrl: 'https://myccs.supabase.co',
          publishableKey: 'sb_publishable_ok',
          fetchFn: fetchFn as unknown as typeof fetch,
        })
      ).rejects.toThrow('Failed to load certification keys (503).');

      fetchFn.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ keys: [{ id: 'bad-row' }] }),
      });
      await expect(
        fetchMyDecryptedCertificationKeys({
          accessToken: 'jwt-ok',
          supabaseUrl: 'https://myccs.supabase.co',
          publishableKey: 'sb_publishable_ok',
          fetchFn: fetchFn as unknown as typeof fetch,
        })
      ).rejects.toThrow();
    });
  });

  describe('src/services/pushNotifications.ts', () => {
    it('registers valid Expo push tokens via RPC and rejects malformed tokens before RPC', async () => {
      const { client, rpcMock } = createMockPushTokensClient();

      const registered = await registerDevicePushToken(
        client,
        VALID_PUSH_TOKEN,
        'android'
      );
      expect(registered).toEqual({
        id: PUSH_TOKEN_ROW_ID,
        expoPushToken: VALID_PUSH_TOKEN,
        platform: 'android',
        updatedAt: '2026-11-28T05:00:00.000Z',
      });
      expect(rpcMock).toHaveBeenCalledWith('register_push_token', {
        p_expo_push_token: VALID_PUSH_TOKEN,
        p_platform: 'android',
      });

      rpcMock.mockClear();
      await expect(
        registerDevicePushToken(client, 'not-a-valid-token', 'ios')
      ).rejects.toThrow();
      expect(rpcMock).not.toHaveBeenCalled();
    });

    it('syncs push token from driver when present and returns null when absent', async () => {
      const { client, rpcMock } = createMockPushTokensClient();

      const nullDriver: PushTokenDriver = {
        getExpoPushToken: jest.fn().mockResolvedValue(null),
        getPlatform: () => 'ios',
      };
      await expect(syncDevicePushToken(client, nullDriver)).resolves.toBeNull();
      expect(rpcMock).not.toHaveBeenCalled();

      const activeDriver: PushTokenDriver = {
        getExpoPushToken: jest.fn().mockResolvedValue(VALID_PUSH_TOKEN),
        getPlatform: () => 'ios',
      };
      const synced = await syncDevicePushToken(client, activeDriver);
      expect(synced?.expoPushToken).toBe(VALID_PUSH_TOKEN);
      expect(synced?.platform).toBe('ios');
    });

    it('unregisters push tokens and propagates delete errors', async () => {
      const { client, deleteEqMock } = createMockPushTokensClient();
      await unregisterDevicePushToken(client, VALID_PUSH_TOKEN);
      expect(deleteEqMock).toHaveBeenCalledWith(
        'expo_push_token',
        VALID_PUSH_TOKEN
      );

      const failing = createMockPushTokensClient({
        deleteError: 'Permission denied',
      });
      await expect(
        unregisterDevicePushToken(failing.client, VALID_PUSH_TOKEN)
      ).rejects.toThrow('Permission denied');
    });

    it('resolves GMetrix deep links and manages initial + live Linking subscriptions cleanly', async () => {
      expect(resolveDeepLinkToHubRoute(GMETRIX_MY_KEYS_DEEP_LINK)).toEqual({
        tab: 'keys',
        section: 'my_keys',
      });
      expect(
        resolveDeepLinkToHubRoute('MYCCS://certifications/my-keys/?src=push#top')
      ).toEqual({
        tab: 'keys',
        section: 'my_keys',
      });
      expect(resolveDeepLinkToHubRoute(null)).toBeNull();
      expect(resolveDeepLinkToHubRoute('myccs://events/123')).toBeNull();

      const onRoute = jest.fn();
      const { linking, emitUrl, removeSpy } = createFakeLinking(
        GMETRIX_MY_KEYS_DEEP_LINK
      );
      const unsubscribe = subscribeToNotificationDeepLinks(onRoute, linking);

      await waitFor(() => {
        expect(onRoute).toHaveBeenCalledTimes(1);
      });
      expect(onRoute).toHaveBeenCalledWith({
        tab: 'keys',
        section: 'my_keys',
      });

      emitUrl('myccs://events/ignored');
      expect(onRoute).toHaveBeenCalledTimes(1);

      emitUrl(GMETRIX_MY_KEYS_DEEP_LINK);
      expect(onRoute).toHaveBeenCalledTimes(2);

      unsubscribe();
      expect(removeSpy).toHaveBeenCalledTimes(1);

      emitUrl(GMETRIX_MY_KEYS_DEEP_LINK);
      expect(onRoute).toHaveBeenCalledTimes(2);
    });

    it('does not fire onRoute if unsubscribed before getInitialURL resolves', async () => {
      const initialDeferred = createDeferred<string | null>();
      const onRoute = jest.fn();
      const linking: LinkingLike = {
        getInitialURL: jest.fn(() => initialDeferred.promise),
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      };

      const unsubscribe = subscribeToNotificationDeepLinks(onRoute, linking);
      unsubscribe();
      initialDeferred.resolve(GMETRIX_MY_KEYS_DEEP_LINK);
      await Promise.resolve();
      expect(onRoute).not.toHaveBeenCalled();
    });
  });

  describe('<CertificationsAndKeysView />', () => {
    it('masks keys by default, toggles reveal/hide with selectable text, and invokes onMarkKeyViewed once', async () => {
      const onMarkKeyViewed = jest.fn().mockResolvedValue(undefined);
      const onSelectSection = jest.fn();
      const onOpenNotification = jest.fn();

      const view = await render(
        createElement(CertificationsAndKeysView, {
          section: 'my_keys',
          certifications: SAMPLE_CERTIFICATIONS.filter((c) => c.is_active),
          keys: SAMPLE_KEYS,
          notifications: SAMPLE_NOTIFICATIONS,
          onSelectSection,
          onMarkKeyViewed,
          onOpenNotification,
        })
      );

      expect(
        within(view.getByTestId('keys-alerts-unread-badge')).getByText('1')
      ).toBeTruthy();

      const maskedText = view.getByTestId(`cert-key-value-${KEY_NEW_ID}`);
      expect(maskedText.props.children).toBe(
        maskCertificationKey(SAMPLE_KEYS[0].keyCode)
      );
      expect(maskedText.props.selectable).toBe(false);
      expect(view.queryByText(SAMPLE_KEYS[0].keyCode)).toBeNull();

      await fireEvent.press(view.getByTestId(`reveal-key-${KEY_NEW_ID}`));
      const revealedText = view.getByTestId(`cert-key-value-${KEY_NEW_ID}`);
      expect(revealedText.props.children).toBe(SAMPLE_KEYS[0].keyCode);
      expect(revealedText.props.selectable).toBe(true);
      expect(onMarkKeyViewed).toHaveBeenCalledTimes(1);
      expect(onMarkKeyViewed).toHaveBeenCalledWith(KEY_NEW_ID);

      await fireEvent.press(view.getByTestId(`reveal-key-${KEY_NEW_ID}`));
      expect(view.queryByText(SAMPLE_KEYS[0].keyCode)).toBeNull();
      await fireEvent.press(view.getByTestId(`reveal-key-${KEY_NEW_ID}`));
      expect(onMarkKeyViewed).toHaveBeenCalledTimes(1);

      await fireEvent.press(view.getByTestId(`reveal-key-${KEY_VIEWED_ID}`));
      expect(
        view.getByTestId(`cert-key-value-${KEY_VIEWED_ID}`).props.children
      ).toBe(SAMPLE_KEYS[1].keyCode);
      expect(onMarkKeyViewed).toHaveBeenCalledTimes(1);
    });

    it('renders empty and error states cleanly across sections', async () => {
      const view = await render(
        createElement(CertificationsAndKeysView, {
          section: 'my_keys',
          certifications: [],
          keys: [],
          notifications: [],
          keysError: 'Key service unavailable.',
          onSelectSection: jest.fn(),
          onMarkKeyViewed: jest.fn(),
          onOpenNotification: jest.fn(),
        })
      );

      expect(view.getByTestId('keys-error-banner')).toBeTruthy();
      expect(view.getByTestId('keys-empty')).toBeTruthy();
      expect(view.queryByTestId('keys-alerts-unread-badge')).toBeNull();

      await view.rerender(
        createElement(CertificationsAndKeysView, {
          section: 'directory',
          certifications: [],
          keys: [],
          notifications: [],
          certificationsError: 'Directory offline.',
          onSelectSection: jest.fn(),
          onMarkKeyViewed: jest.fn(),
          onOpenNotification: jest.fn(),
        })
      );
      expect(view.getByTestId('certifications-error-banner')).toBeTruthy();
      expect(view.getByTestId('certifications-empty')).toBeTruthy();

      await view.rerender(
        createElement(CertificationsAndKeysView, {
          section: 'notifications',
          certifications: [],
          keys: [],
          notifications: [],
          notificationsError: 'Alerts offline.',
          onSelectSection: jest.fn(),
          onMarkKeyViewed: jest.fn(),
          onOpenNotification: jest.fn(),
        })
      );
      expect(view.getByTestId('notifications-error-banner')).toBeTruthy();
      expect(view.getByTestId('notifications-empty')).toBeTruthy();
    });
  });

  describe('<MyCcsHubScreen /> Keys tab, Alerts, Deep Links & Push Sync', () => {
    it('navigates to Keys, reveals masked key & records viewed_at once, browses Directory, and opens Alerts into My Keys', async () => {
      const { client: certClient, spies: certSpies } =
        createMockCertificationsClient({
          certifications: SAMPLE_CERTIFICATIONS,
          notifications: SAMPLE_NOTIFICATIONS,
          keyViewedAtById: {
            [KEY_NEW_ID]: null,
            [KEY_VIEWED_ID]: '2026-11-21T09:30:00.000Z',
          },
        });
      const onFetchMyCertificationKeys = jest
        .fn()
        .mockResolvedValue(SAMPLE_KEYS.map((k) => ({ ...k })));
      const { client: pushClient, rpcMock } = createMockPushTokensClient();
      const pushTokenDriver: PushTokenDriver = {
        getExpoPushToken: jest.fn().mockResolvedValue(VALID_PUSH_TOKEN),
        getPlatform: () => 'android',
      };

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          certificationsClient: certClient,
          onFetchMyCertificationKeys,
          pushTokenDriver,
          pushTokensClient: pushClient,
        })
      );

      await waitFor(() => {
        expect(rpcMock).toHaveBeenCalledWith('register_push_token', {
          p_expo_push_token: VALID_PUSH_TOKEN,
          p_platform: 'android',
        });
      });
      await waitFor(() => {
        expect(
          within(screen.getByTestId('tab-keys-unread-badge')).getByText('1')
        ).toBeTruthy();
      });

      await fireEvent.press(screen.getByTestId('tab-keys'));
      await waitFor(() => {
        expect(
          screen.getByTestId(`cert-key-value-${KEY_NEW_ID}`).props.children
        ).toBe(maskCertificationKey(SAMPLE_KEYS[0].keyCode));
      });
      expect(screen.queryByText(SAMPLE_KEYS[0].keyCode)).toBeNull();
      expect(
        screen.getByTestId(`cert-key-status-${KEY_NEW_ID}`)
      ).toBeTruthy();

      await fireEvent.press(screen.getByTestId(`reveal-key-${KEY_NEW_ID}`));
      await waitFor(() => {
        expect(
          screen.getByTestId(`cert-key-value-${KEY_NEW_ID}`).props.children
        ).toBe(SAMPLE_KEYS[0].keyCode);
      });
      await waitFor(() => {
        expect(certSpies.markKeyViewed).toHaveBeenCalledTimes(1);
      });
      expect(certSpies.markKeyViewed).toHaveBeenCalledWith(
        KEY_NEW_ID,
        expect.any(String)
      );

      await fireEvent.press(screen.getByTestId(`reveal-key-${KEY_NEW_ID}`));
      await fireEvent.press(screen.getByTestId(`reveal-key-${KEY_NEW_ID}`));
      expect(certSpies.markKeyViewed).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByTestId('keys-section-directory'));
      expect(
        screen.getByTestId(`certification-item-${CERT_COMPTIA_ID}`)
      ).toBeTruthy();
      expect(
        screen.getByTestId(`certification-item-${CERT_CISCO_ID}`)
      ).toBeTruthy();
      expect(
        screen.queryByTestId(`certification-item-${CERT_INACTIVE_ID}`)
      ).toBeNull();

      await fireEvent.press(screen.getByTestId('keys-section-notifications'));
      expect(
        screen.getByTestId(`notification-item-${NOTIF_UNREAD_ID}`)
      ).toBeTruthy();
      expect(screen.getByText('Unread')).toBeTruthy();

      await fireEvent.press(
        screen.getByTestId(`notification-item-${NOTIF_UNREAD_ID}`)
      );

      await waitFor(() => {
        expect(screen.getByTestId('keys-section-view-my_keys')).toBeTruthy();
      });
      await waitFor(() => {
        expect(certSpies.markNotificationRead).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByTestId('tab-keys-unread-badge')).toBeNull();
      expect(screen.queryByTestId('keys-alerts-unread-badge')).toBeNull();
    });

    it('routes directly to Keys -> My Keys from initialDeepLinkUrl and live Linking events', async () => {
      const { client: certClient } = createMockCertificationsClient({
        certifications: SAMPLE_CERTIFICATIONS,
        notifications: SAMPLE_NOTIFICATIONS,
        keyViewedAtById: { [KEY_NEW_ID]: null },
      });
      const onFetchMyCertificationKeys = jest
        .fn()
        .mockResolvedValue([SAMPLE_KEYS[0]]);

      const initialScreen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          certificationsClient: certClient,
          onFetchMyCertificationKeys,
          initialDeepLinkUrl: GMETRIX_MY_KEYS_DEEP_LINK,
        })
      );

      await waitFor(() => {
        expect(
          initialScreen.getByTestId('keys-section-view-my_keys')
        ).toBeTruthy();
      });
      await waitFor(() => {
        expect(
          initialScreen.getByTestId(`cert-key-value-${KEY_NEW_ID}`).props
            .children
        ).toBe(maskCertificationKey(SAMPLE_KEYS[0].keyCode));
      });
      await initialScreen.unmount();

      let urlListener: ((event: { url: string }) => void) | null = null;
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
      jest
        .spyOn(Linking, 'addEventListener')
        .mockImplementation((_type, handler) => {
          urlListener = handler as (event: { url: string }) => void;
          return { remove: jest.fn() } as ReturnType<
            typeof Linking.addEventListener
          >;
        });

      const liveScreen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          certificationsClient: certClient,
          onFetchMyCertificationKeys,
        })
      );

      expect(liveScreen.queryByTestId('keys-section-view-my_keys')).toBeNull();

      await act(async () => {
        urlListener?.({ url: GMETRIX_MY_KEYS_DEEP_LINK });
      });

      await waitFor(() => {
        expect(
          liveScreen.getByTestId('keys-section-view-my_keys')
        ).toBeTruthy();
      });
    });

    it('supports refreshing Keys tab and ignores stale in-flight key loads when leaving the tab', async () => {
      const firstFetch = createDeferred<DecryptedCertificationKey[]>();
      const onFetchMyCertificationKeys = jest
        .fn()
        .mockImplementationOnce(() => firstFetch.promise)
        .mockResolvedValueOnce([SAMPLE_KEYS[1]]);
      const { client: certClient } = createMockCertificationsClient({
        certifications: SAMPLE_CERTIFICATIONS,
        notifications: [],
        keyViewedAtById: { [KEY_VIEWED_ID]: '2026-11-21T09:30:00.000Z' },
      });

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          certificationsClient: certClient,
          onFetchMyCertificationKeys,
        })
      );

      await fireEvent.press(screen.getByTestId('tab-keys'));
      expect(screen.getByTestId('keys-loading')).toBeTruthy();

      await fireEvent.press(screen.getByTestId('tab-feed'));
      await act(async () => {
        firstFetch.resolve([SAMPLE_KEYS[0]]);
        await Promise.resolve();
      });

      await fireEvent.press(screen.getByTestId('tab-keys'));
      await waitFor(() => {
        expect(screen.getByTestId(`cert-key-item-${KEY_VIEWED_ID}`)).toBeTruthy();
      });
      expect(screen.queryByTestId(`cert-key-item-${KEY_NEW_ID}`)).toBeNull();

      onFetchMyCertificationKeys.mockResolvedValueOnce(SAMPLE_KEYS);
      await fireEvent.press(screen.getByTestId('hub-refresh-button'));
      await waitFor(() => {
        expect(screen.getByTestId(`cert-key-item-${KEY_NEW_ID}`)).toBeTruthy();
      });
    });

    it('uses default runtime fetchMyDecryptedCertificationKeys path when onFetchMyCertificationKeys is omitted', async () => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://runtime.supabase.co';
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
        'sb_publishable_runtime';

      const { client: certClient } = createMockCertificationsClient({
        certifications: SAMPLE_CERTIFICATIONS,
        notifications: [],
        keyViewedAtById: { [KEY_NEW_ID]: null },
        sessionAccessToken: 'jwt-runtime-student',
      });

      const originalFetch = globalThis.fetch;
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ keys: [SAMPLE_KEYS[0]] }),
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const emptyDeptOrgClient = {
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
            is: () => ({
              order: () => {
                const terminal = {
                  then: (
                    onfulfilled?: (v: { data: unknown[]; error: null }) => unknown
                  ) => Promise.resolve({ data: [], error: null }).then(onfulfilled),
                  order: () => terminal,
                  limit: () => Promise.resolve({ data: [], error: null }),
                };
                return terminal;
              },
            }),
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };

      try {
        const screen = await render(
          createElement(MyCcsHubScreen, {
            profile: STUDENT_PROFILE,
            busy: false,
            errorMessage: null,
            onSignOut: jest.fn(),
            deptOrgClient: emptyDeptOrgClient as never,
            certificationsClient: certClient,
            initialDeepLinkUrl: GMETRIX_MY_KEYS_DEEP_LINK,
          })
        );

        await waitFor(() => {
          expect(
            screen.getByTestId(`cert-key-value-${KEY_NEW_ID}`).props.children
          ).toBe(maskCertificationKey(SAMPLE_KEYS[0].keyCode));
        });
        expect(fetchMock).toHaveBeenCalledWith(
          'https://runtime.supabase.co/functions/v1/my-certification-keys',
          expect.objectContaining({
            method: 'GET',
            headers: {
              Authorization: 'Bearer jwt-runtime-student',
              apikey: 'sb_publishable_runtime',
            },
          })
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('reloads fresh keys immediately when a my-keys deep link arrives while already on Keys tab', async () => {
      let urlListener: ((event: { url: string }) => void) | null = null;
      jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
      jest
        .spyOn(Linking, 'addEventListener')
        .mockImplementation((_type, handler) => {
          urlListener = handler as (event: { url: string }) => void;
          return { remove: jest.fn() } as ReturnType<
            typeof Linking.addEventListener
          >;
        });

      const { client: certClient } = createMockCertificationsClient({
        certifications: SAMPLE_CERTIFICATIONS,
        notifications: [SAMPLE_NOTIFICATIONS[1]],
        keyViewedAtById: {
          [KEY_VIEWED_ID]: '2026-11-21T09:30:00.000Z',
          [KEY_NEW_ID]: null,
        },
      });
      const onFetchMyCertificationKeys = jest
        .fn()
        .mockResolvedValueOnce([SAMPLE_KEYS[1]])
        .mockResolvedValueOnce(SAMPLE_KEYS)
        .mockResolvedValueOnce([SAMPLE_KEYS[0]]);

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          certificationsClient: certClient,
          onFetchMyCertificationKeys,
        })
      );

      await fireEvent.press(screen.getByTestId('tab-keys'));
      await waitFor(() => {
        expect(
          screen.getByTestId(`cert-key-item-${KEY_VIEWED_ID}`)
        ).toBeTruthy();
      });
      expect(screen.queryByTestId(`cert-key-item-${KEY_NEW_ID}`)).toBeNull();
      expect(onFetchMyCertificationKeys).toHaveBeenCalledTimes(1);

      await act(async () => {
        urlListener?.({ url: GMETRIX_MY_KEYS_DEEP_LINK });
      });

      await waitFor(() => {
        expect(screen.getByTestId(`cert-key-item-${KEY_NEW_ID}`)).toBeTruthy();
      });
      expect(onFetchMyCertificationKeys).toHaveBeenCalledTimes(2);

      await fireEvent.press(screen.getByTestId('keys-section-directory'));
      expect(
        screen.getByTestId('keys-section-view-directory')
      ).toBeTruthy();

      await act(async () => {
        urlListener?.({ url: GMETRIX_MY_KEYS_DEEP_LINK });
      });

      await waitFor(() => {
        expect(screen.getByTestId('keys-section-view-my_keys')).toBeTruthy();
      });
      await waitFor(() => {
        expect(onFetchMyCertificationKeys).toHaveBeenCalledTimes(3);
      });
      expect(screen.queryByTestId(`cert-key-item-${KEY_VIEWED_ID}`)).toBeNull();
      expect(screen.getByTestId(`cert-key-item-${KEY_NEW_ID}`)).toBeTruthy();
    });

    it('unregisters synced Expo push token before invoking onSignOut and still signs out if cleanup fails', async () => {
      const deleteDeferred = createDeferred<{ error: { message: string } | null }>();
      const {
        client: pushClient,
        rpcMock,
        deleteEqMock,
      } = createMockPushTokensClient({
        onDelete: () => deleteDeferred.promise,
      });
      const pushTokenDriver: PushTokenDriver = {
        getExpoPushToken: jest.fn().mockResolvedValue(VALID_PUSH_TOKEN),
        getPlatform: () => 'android',
      };
      const onSignOut = jest.fn();

      const screen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut,
          pushTokenDriver,
          pushTokensClient: pushClient,
        })
      );

      await waitFor(() => {
        expect(rpcMock).toHaveBeenCalledWith('register_push_token', {
          p_expo_push_token: VALID_PUSH_TOKEN,
          p_platform: 'android',
        });
      });

      await fireEvent.press(screen.getByTestId('tab-identity'));
      await fireEvent.press(screen.getByTestId('signout-button'));

      expect(deleteEqMock).toHaveBeenCalledTimes(1);
      expect(deleteEqMock).toHaveBeenCalledWith(
        'expo_push_token',
        VALID_PUSH_TOKEN
      );
      expect(onSignOut).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByTestId('signout-button'));
      expect(deleteEqMock).toHaveBeenCalledTimes(1);
      expect(onSignOut).not.toHaveBeenCalled();

      await act(async () => {
        deleteDeferred.resolve({ error: null });
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(onSignOut).toHaveBeenCalledTimes(1);
      });
      await screen.unmount();

      const failingPush = createMockPushTokensClient({
        deleteError: 'Push delete failed',
      });
      const failingSignOut = jest.fn();

      const failingScreen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: failingSignOut,
          pushTokenDriver,
          pushTokensClient: failingPush.client,
        })
      );

      await waitFor(() => {
        expect(failingPush.rpcMock).toHaveBeenCalledTimes(1);
      });

      await fireEvent.press(failingScreen.getByTestId('tab-identity'));
      await fireEvent.press(failingScreen.getByTestId('signout-button'));

      await waitFor(() => {
        expect(failingSignOut).toHaveBeenCalledTimes(1);
      });
      expect(failingPush.deleteEqMock).toHaveBeenCalledWith(
        'expo_push_token',
        VALID_PUSH_TOKEN
      );
    });

    it('prevents slow mount-time notification fetch from overwriting Keys-tab alerts and refreshes badge from Feed', async () => {
      const slowMountNotifs =
        createDeferred<CertificationsQueryResult<unknown[]>>();
      let notifFetchCount = 0;

      const { client: raceClient } = createMockCertificationsClient({
        certifications: SAMPLE_CERTIFICATIONS,
        notifications: [SAMPLE_NOTIFICATIONS[0]],
        keyViewedAtById: { [KEY_NEW_ID]: null },
        onFetchNotifications: async () => {
          notifFetchCount += 1;
          if (notifFetchCount === 1) {
            return slowMountNotifs.promise;
          }
          return undefined;
        },
      });
      const onFetchMyCertificationKeys = jest
        .fn()
        .mockResolvedValue([SAMPLE_KEYS[0]]);

      const raceScreen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          certificationsClient: raceClient,
          onFetchMyCertificationKeys,
        })
      );

      expect(notifFetchCount).toBe(1);

      await fireEvent.press(raceScreen.getByTestId('tab-keys'));
      await waitFor(() => {
        expect(
          within(raceScreen.getByTestId('tab-keys-unread-badge')).getByText('1')
        ).toBeTruthy();
      });

      await act(async () => {
        slowMountNotifs.resolve({ data: [], error: null });
        await Promise.resolve();
      });

      expect(
        within(raceScreen.getByTestId('tab-keys-unread-badge')).getByText('1')
      ).toBeTruthy();
      await fireEvent.press(
        raceScreen.getByTestId('keys-section-notifications')
      );
      expect(
        raceScreen.getByTestId(`notification-item-${NOTIF_UNREAD_ID}`)
      ).toBeTruthy();
      await raceScreen.unmount();

      const { client: feedRefreshClient, state: feedRefreshState } =
        createMockCertificationsClient({
          certifications: SAMPLE_CERTIFICATIONS,
          notifications: [SAMPLE_NOTIFICATIONS[1]],
          keyViewedAtById: {},
        });
      const emptyDeptOrgClient = {
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
            is: () => ({
              order: () => {
                const terminal = {
                  then: (
                    onfulfilled?: (v: { data: unknown[]; error: null }) => unknown
                  ) =>
                    Promise.resolve({ data: [], error: null }).then(onfulfilled),
                  order: () => terminal,
                  limit: () => Promise.resolve({ data: [], error: null }),
                };
                return terminal;
              },
            }),
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };

      const feedScreen = await render(
        createElement(MyCcsHubScreen, {
          profile: STUDENT_PROFILE,
          busy: false,
          errorMessage: null,
          onSignOut: jest.fn(),
          deptOrgClient: emptyDeptOrgClient as never,
          certificationsClient: feedRefreshClient,
        })
      );

      await waitFor(() => {
        expect(feedScreen.getByTestId('announcements-empty')).toBeTruthy();
      });
      expect(feedScreen.queryByTestId('tab-keys-unread-badge')).toBeNull();

      feedRefreshState.notifications.unshift({ ...SAMPLE_NOTIFICATIONS[0] });

      await fireEvent.press(feedScreen.getByTestId('hub-refresh-button'));
      await waitFor(() => {
        expect(
          within(feedScreen.getByTestId('tab-keys-unread-badge')).getByText('1')
        ).toBeTruthy();
      });
    });
  });
});
