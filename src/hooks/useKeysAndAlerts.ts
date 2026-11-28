import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { MobileHubRoute } from '../../shared/dept-org';
import type {
  Certification,
  DecryptedCertificationKey,
  Notification,
} from '../../shared/gmetrix';
import {
  getClientSupabaseConfig,
  getSupabaseClient,
  isSupabaseConfigured,
} from '../lib/supabase';
import {
  adaptCertificationsSupabaseClient,
  fetchActiveCertifications,
  fetchMyDecryptedCertificationKeys,
  fetchMyNotifications,
  markCertificationKeyViewed,
  markNotificationRead,
  type CertificationsSupabaseClient,
} from '../services/certifications';
import {
  adaptPushTokensRpcClient,
  resolveDeepLinkToHubRoute,
  subscribeToNotificationDeepLinks,
  syncDevicePushToken,
  unregisterDevicePushToken,
  type PushTokenDriver,
  type PushTokensRpcClient,
} from '../services/pushNotifications';

export interface UseKeysAndAlertsParams {
  profileId: string;
  route: MobileHubRoute;
  setRoute: Dispatch<SetStateAction<MobileHubRoute>>;
  hasDeptOrgClient: boolean;
  certificationsClient?: CertificationsSupabaseClient;
  onFetchMyCertificationKeys?: () => Promise<DecryptedCertificationKey[]>;
  pushTokenDriver?: PushTokenDriver;
  pushTokensClient?: PushTokensRpcClient;
  initialDeepLinkUrl?: string | null;
  onSignOut: () => void;
}

export interface UseKeysAndAlertsResult {
  certifications: Certification[];
  decryptedKeys: DecryptedCertificationKey[];
  notifications: Notification[];
  keysLoading: boolean;
  keysError: string | null;
  certificationsError: string | null;
  notificationsError: string | null;
  unreadAlertsCount: number;
  loadKeysHubData: () => Promise<void>;
  refreshNotificationsBadge: () => Promise<void>;
  handleMarkKeyViewed: (keyId: string) => Promise<void>;
  handleOpenNotification: (notification: Notification) => Promise<void>;
  handleSignOutWithPushCleanup: () => Promise<void>;
}

function isKeysRoute(ref: { current: MobileHubRoute }): boolean {
  return ref.current.tab === 'keys';
}

function mergeViewedKeyOverrides(
  fetched: DecryptedCertificationKey[],
  overrides: Map<string, string>
): DecryptedCertificationKey[] {
  if (overrides.size === 0) {
    return fetched;
  }
  return fetched.map((item) => {
    const overrideViewedAt = overrides.get(item.id);
    if (!overrideViewedAt) {
      return item;
    }
    if (item.viewedAt !== null) {
      overrides.delete(item.id);
      return item;
    }
    return { ...item, viewedAt: overrideViewedAt };
  });
}

function mergeReadNotificationOverrides(
  fetched: Notification[],
  overrides: Map<string, string>
): Notification[] {
  if (overrides.size === 0) {
    return fetched;
  }
  return fetched.map((item) => {
    const overrideReadAt = overrides.get(item.id);
    if (!overrideReadAt) {
      return item;
    }
    if (item.read_at !== null) {
      overrides.delete(item.id);
      return item;
    }
    return { ...item, read_at: overrideReadAt };
  });
}

export function useKeysAndAlerts({
  profileId,
  route,
  setRoute,
  hasDeptOrgClient,
  certificationsClient,
  onFetchMyCertificationKeys,
  pushTokenDriver,
  pushTokensClient,
  initialDeepLinkUrl,
  onSignOut,
}: UseKeysAndAlertsParams): UseKeysAndAlertsResult {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [decryptedKeys, setDecryptedKeys] = useState<
    DecryptedCertificationKey[]
  >([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [certificationsError, setCertificationsError] = useState<string | null>(
    null
  );
  const [notificationsError, setNotificationsError] = useState<string | null>(
    null
  );

  const mountedRef = useRef(true);
  const routeRef = useRef(route);
  routeRef.current = route;
  const keysReqIdRef = useRef(0);
  const viewedKeyOverridesRef = useRef<Map<string, string>>(new Map());
  const readNotifOverridesRef = useRef<Map<string, string>>(new Map());
  const syncedPushTokenRef = useRef<string | null>(null);
  const signingOutPushRef = useRef(false);
  const prevInitialDeepLinkRef = useRef<string | null | undefined>(
    initialDeepLinkUrl
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resolveCertificationsClient =
    useCallback((): CertificationsSupabaseClient => {
      return (
        certificationsClient ??
        adaptCertificationsSupabaseClient(getSupabaseClient())
      );
    }, [certificationsClient]);

  const resolvePushTokensClient =
    useCallback((): PushTokensRpcClient | null => {
      if (pushTokensClient) {
        return pushTokensClient;
      }
      if (isSupabaseConfigured()) {
        return adaptPushTokensRpcClient(getSupabaseClient());
      }
      return null;
    }, [pushTokensClient]);

  const loadKeysHubData = useCallback(async () => {
    const canQueryCertTables =
      Boolean(certificationsClient) || isSupabaseConfigured();
    const canFetchKeys =
      Boolean(onFetchMyCertificationKeys) || isSupabaseConfigured();

    const requestId = ++keysReqIdRef.current;

    if (!canQueryCertTables && !canFetchKeys) {
      if (mountedRef.current) {
        setKeysLoading(false);
      }
      return;
    }

    if (mountedRef.current) {
      setKeysLoading(true);
      setKeysError(null);
      setCertificationsError(null);
      setNotificationsError(null);
    }

    const certsPromise = canQueryCertTables
      ? fetchActiveCertifications(resolveCertificationsClient())
      : Promise.resolve<Certification[] | null>(null);

    const notificationsPromise = canQueryCertTables
      ? fetchMyNotifications(resolveCertificationsClient(), profileId)
      : Promise.resolve<Notification[] | null>(null);

    const keysPromise = (async (): Promise<
      DecryptedCertificationKey[] | null
    > => {
      if (onFetchMyCertificationKeys) {
        return onFetchMyCertificationKeys();
      }
      if (!isSupabaseConfigured()) {
        return null;
      }
      const client = resolveCertificationsClient();
      const sessionResult = await client.auth?.getSession();
      const accessToken = sessionResult?.data.session?.access_token ?? '';
      if (!accessToken) {
        throw new Error(
          'Active session token required before viewing certification keys.'
        );
      }
      const { supabaseUrl, publishableKey } = getClientSupabaseConfig();
      return fetchMyDecryptedCertificationKeys({
        accessToken,
        supabaseUrl,
        publishableKey,
      });
    })();

    const [certsResult, notificationsResult, keysResult] =
      await Promise.allSettled([certsPromise, notificationsPromise, keysPromise]);

    if (!mountedRef.current || keysReqIdRef.current !== requestId) {
      return;
    }

    if (certsResult.status === 'fulfilled') {
      if (certsResult.value !== null) {
        setCertifications(certsResult.value);
      }
    } else {
      setCertificationsError(
        certsResult.reason instanceof Error
          ? certsResult.reason.message
          : 'Failed to load certification directory.'
      );
    }

    if (notificationsResult.status === 'fulfilled') {
      if (notificationsResult.value !== null) {
        setNotifications(
          mergeReadNotificationOverrides(
            notificationsResult.value,
            readNotifOverridesRef.current
          )
        );
      }
    } else {
      setNotificationsError(
        notificationsResult.reason instanceof Error
          ? notificationsResult.reason.message
          : 'Failed to load alerts.'
      );
    }

    if (keysResult.status === 'fulfilled') {
      if (keysResult.value !== null) {
        setDecryptedKeys(
          mergeViewedKeyOverrides(
            keysResult.value,
            viewedKeyOverridesRef.current
          )
        );
      }
    } else {
      setKeysError(
        keysResult.reason instanceof Error
          ? keysResult.reason.message
          : 'Failed to load certification keys.'
      );
    }

    setKeysLoading(false);
  }, [
    certificationsClient,
    onFetchMyCertificationKeys,
    profileId,
    resolveCertificationsClient,
  ]);

  const loadKeysHubDataRef = useRef(loadKeysHubData);
  loadKeysHubDataRef.current = loadKeysHubData;

  const canQueryNotificationsOffKeys =
    Boolean(certificationsClient) ||
    (!hasDeptOrgClient && isSupabaseConfigured());

  const refreshNotificationsBadge = useCallback(async () => {
    if (isKeysRoute(routeRef) || !canQueryNotificationsOffKeys) {
      return;
    }
    const requestId = ++keysReqIdRef.current;
    try {
      const rows = await fetchMyNotifications(
        resolveCertificationsClient(),
        profileId
      );
      if (
        !mountedRef.current ||
        isKeysRoute(routeRef) ||
        keysReqIdRef.current !== requestId
      ) {
        return;
      }
      setNotifications(
        mergeReadNotificationOverrides(rows, readNotifOverridesRef.current)
      );
    } catch {
      return;
    }
  }, [
    canQueryNotificationsOffKeys,
    profileId,
    resolveCertificationsClient,
  ]);

  useEffect(() => {
    if (prevInitialDeepLinkRef.current === initialDeepLinkUrl) {
      return;
    }
    prevInitialDeepLinkRef.current = initialDeepLinkUrl;
    const resolved = resolveDeepLinkToHubRoute(initialDeepLinkUrl);
    if (!resolved) {
      return;
    }
    const alreadyOnKeys = isKeysRoute(routeRef);
    setRoute(resolved);
    if (alreadyOnKeys) {
      void loadKeysHubDataRef.current();
    }
  }, [initialDeepLinkUrl, setRoute]);

  useEffect(() => {
    return subscribeToNotificationDeepLinks((nextRoute) => {
      if (!mountedRef.current) {
        return;
      }
      const alreadyOnKeys = isKeysRoute(routeRef);
      setRoute(nextRoute);
      if (alreadyOnKeys) {
        void loadKeysHubDataRef.current();
      }
    });
  }, [setRoute]);

  useEffect(() => {
    const client = resolvePushTokensClient();
    syncedPushTokenRef.current = null;
    if (!pushTokenDriver || !client) {
      return;
    }
    let cancelled = false;
    void syncDevicePushToken(client, pushTokenDriver)
      .then((registered) => {
        if (!cancelled && mountedRef.current) {
          syncedPushTokenRef.current = registered?.expoPushToken ?? null;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profileId, pushTokenDriver, resolvePushTokensClient]);

  useEffect(() => {
    if (isKeysRoute(routeRef)) {
      return;
    }
    void refreshNotificationsBadge();
    return () => {
      if (!isKeysRoute(routeRef)) {
        keysReqIdRef.current += 1;
      }
    };
  }, [refreshNotificationsBadge]);

  const isKeysTab = route.tab === 'keys';

  useEffect(() => {
    if (!isKeysTab) {
      return;
    }
    void loadKeysHubData();
    return () => {
      keysReqIdRef.current += 1;
      if (mountedRef.current) {
        setKeysLoading(false);
      }
    };
  }, [isKeysTab, loadKeysHubData]);

  const handleMarkKeyViewed = useCallback(
    async (keyId: string) => {
      let nextViewedAt = new Date().toISOString();
      if (certificationsClient || isSupabaseConfigured()) {
        const updated = await markCertificationKeyViewed(
          resolveCertificationsClient(),
          keyId
        );
        if (updated) {
          nextViewedAt = updated.viewedAt;
        }
      }
      viewedKeyOverridesRef.current.set(keyId, nextViewedAt);
      if (mountedRef.current) {
        setDecryptedKeys((current) =>
          current.map((item) =>
            item.id === keyId
              ? { ...item, viewedAt: item.viewedAt ?? nextViewedAt }
              : item
          )
        );
      }
    },
    [certificationsClient, resolveCertificationsClient]
  );

  const handleOpenNotification = useCallback(
    async (notification: Notification) => {
      const deepRoute = resolveDeepLinkToHubRoute(notification.deep_link);
      if (deepRoute && mountedRef.current) {
        setRoute(deepRoute);
      }
      if (notification.read_at !== null) {
        return;
      }
      try {
        let nextReadAt = new Date().toISOString();
        let updatedRow: Notification | null = null;
        if (certificationsClient || isSupabaseConfigured()) {
          updatedRow = await markNotificationRead(
            resolveCertificationsClient(),
            notification.id
          );
          if (updatedRow?.read_at) {
            nextReadAt = updatedRow.read_at;
          }
        }
        readNotifOverridesRef.current.set(notification.id, nextReadAt);
        if (mountedRef.current) {
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? (updatedRow ?? { ...item, read_at: nextReadAt })
                : item
            )
          );
        }
      } catch (err) {
        if (mountedRef.current) {
          setNotificationsError(
            err instanceof Error ? err.message : 'Failed to mark alert as read.'
          );
        }
      }
    },
    [certificationsClient, resolveCertificationsClient, setRoute]
  );

  const handleSignOutWithPushCleanup = useCallback(async () => {
    if (signingOutPushRef.current) {
      return;
    }
    const token = syncedPushTokenRef.current;
    const client = resolvePushTokensClient();
    if (token && client) {
      signingOutPushRef.current = true;
      syncedPushTokenRef.current = null;
      try {
        await unregisterDevicePushToken(client, token).catch(() => {});
      } finally {
        signingOutPushRef.current = false;
      }
    }
    onSignOut();
  }, [onSignOut, resolvePushTokensClient]);

  const unreadAlertsCount = notifications.filter(
    (item) => item.read_at === null
  ).length;

  return {
    certifications,
    decryptedKeys,
    notifications,
    keysLoading,
    keysError,
    certificationsError,
    notificationsError,
    unreadAlertsCount,
    loadKeysHubData,
    refreshNotificationsBadge,
    handleMarkKeyViewed,
    handleOpenNotification,
    handleSignOutWithPushCleanup,
  };
}
